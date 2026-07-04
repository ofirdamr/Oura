import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client for "use client" components (login/signup, and the
// admin CRUD pages built by the parallel subagent, which import this exact
// function name). Reads the public anon key + project URL from NEXT_PUBLIC_*
// env vars - never hardcode the project URL or key here.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
