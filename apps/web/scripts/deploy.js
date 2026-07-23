#!/usr/bin/env node
// Wrapper deploy script: auto-maps SUPABASE_* → NEXT_PUBLIC_SUPABASE_* and
// trims whitespace from Cloudflare creds (the sandbox injects them with a
// leading space — wrangler fails with an opaque 6111/7003 error if not trimmed).
// Must run as a Node.js script (not an npm sub-script) so env mutations carry
// into the child process that runs opennextjs-cloudflare build + deploy.
const { execSync } = require("child_process");

const trim = (v) => (v || "").trim();

// Map SUPABASE_* → NEXT_PUBLIC_SUPABASE_* if the NEXT_PUBLIC_ variant is absent
// Strip /rest/v1/ suffix if present — SUPABASE_URL is the PostgREST base, but the
// browser Supabase client needs the project URL base for auth (GoTrue) endpoints.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  let url = trim(process.env.SUPABASE_URL);
  if (url.endsWith("/rest/v1/")) {
    url = url.slice(0, -9); // remove "/rest/v1/"
  } else if (url.endsWith("/rest/v1")) {
    url = url.slice(0, -8); // remove "/rest/v1"
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
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
