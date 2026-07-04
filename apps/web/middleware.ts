import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Photographer/admin auth gate. Follows the standard @supabase/ssr Next.js
// middleware recipe: refresh the session on every request and, crucially,
// validate it with `getUser()` (which revalidates against the Supabase auth
// server) rather than `getSession()` (which only decodes the cookie and is
// documented as unsafe to trust in middleware).
//
// The `matcher` below scopes this middleware to /admin and everything under
// it. That intentionally leaves untouched: /login, /signup, static assets,
// and every guest-facing route (/, /join, /gallery-entry, /consent, /gallery,
// /festive-gallery, /minimal-gallery, /gift-reveal, /photo-editor) - guests
// never authenticate (CLAUDE.md), so they must never hit this auth check.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run any code between createServerClient and getUser().
  // A simple mistake here can make it very hard to debug random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  // Scope strictly to the admin area. `:path*` matches both the bare /admin
  // route and any nested route below it.
  matcher: ["/admin/:path*"],
};
