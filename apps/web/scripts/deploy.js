#!/usr/bin/env node
// Wrapper deploy script: auto-maps SUPABASE_* → NEXT_PUBLIC_SUPABASE_* and
// trims whitespace from Cloudflare creds (the sandbox injects them with a
// leading space — wrangler fails with an opaque 6111/7003 error if not trimmed).
// Must run as a Node.js script (not an npm sub-script) so env mutations carry
// into the child process that runs opennextjs-cloudflare build + deploy.
const { execSync } = require("child_process");

const trim = (v) => (v || "").trim();

// Map SUPABASE_* → NEXT_PUBLIC_SUPABASE_* if the NEXT_PUBLIC_ variant is absent
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = trim(process.env.SUPABASE_URL);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = trim(process.env.SUPABASE_ANON_KEY);
}

// Trim Cloudflare creds
process.env.CLOUDFLARE_API_TOKEN = trim(process.env.CLOUDFLARE_API_TOKEN);
process.env.CLOUDFLARE_ACCOUNT_ID = trim(process.env.CLOUDFLARE_ACCOUNT_ID);

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
].filter((k) => !process.env[k]);

if (missing.length) {
  console.error(`\nRefusing to deploy: missing ${missing.join(", ")}.\n`);
  process.exit(1);
}

console.log("→ Building and deploying oura-web...");
execSync("node_modules/.bin/opennextjs-cloudflare build && node_modules/.bin/opennextjs-cloudflare deploy", {
  stdio: "inherit",
  env: process.env,
});
