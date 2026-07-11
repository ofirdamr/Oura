#!/usr/bin/env node
// Fails loud, before the build, if NEXT_PUBLIC_SUPABASE_* isn't mapped.
// Next.js inlines NEXT_PUBLIC_* at build time - a build run without them
// silently ships a middleware bundle that 500s every /admin/* route live.
// See MISTAKES.md 2026-07-10 "Deployed a build with no Supabase env vars".
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(
    `\nRefusing to build/deploy: missing ${missing.join(", ")}.\n` +
      "Next.js inlines these at build time - without them, /admin/* routes " +
      "500 live (middleware can't construct a Supabase client).\n" +
      "Fix: export NEXT_PUBLIC_SUPABASE_URL=\"$SUPABASE_URL\" " +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" first.\n',
  );
  process.exit(1);
}
