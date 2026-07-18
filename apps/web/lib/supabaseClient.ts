import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client for "use client" components (login/signup, and the
// admin CRUD pages built by the parallel subagent, which import this exact
// function name). Reads the public anon key + project URL from NEXT_PUBLIC_*
// env vars - never hardcode the project URL or key here.
//
// `authOverrides` lets a specific page tweak the auth config. The reset-password
// page passes `detectSessionInUrl: false`: createBrowserClient hard-forces
// flowType 'pkce', and the automatic URL detection throws "Not a valid PKCE
// flow url" on the implicit hash tokens that a server-generated recovery link
// carries - it must be disabled there so the page can consume the hash itself.
export function createSupabaseBrowserClient(authOverrides?: {
  detectSessionInUrl?: boolean;
}) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    authOverrides ? { auth: authOverrides } : undefined,
  );
}
