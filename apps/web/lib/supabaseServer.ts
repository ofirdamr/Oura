import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for Server Components and Route Handlers.
// Uses the cookie-adapter shape (`getAll`/`setAll`) that @supabase/ssr 0.6+
// requires; the deprecated get/set/remove trio is intentionally avoided.
// `cookies()` is async in Next 15/16, so this must be awaited by callers.
//
// Note: from within a Server Component the cookie store is read-only and
// `setAll` will throw - that's expected and safe to swallow here, because
// middleware.ts is what actually refreshes and writes back the session
// cookies on every request (the standard @supabase/ssr Next.js recipe).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Session refresh is handled by middleware, so this is a no-op.
          }
        },
      },
    },
  );
}
