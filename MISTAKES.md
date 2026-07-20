# Mistakes Log

Append-only. Log immediately on discovery, before moving on.

---

### 2026-07-18 — Password reset took 3 days: full post-mortem

**Timeline of attempts (in order):**

**(a) Resend only delivered to the account owner.**
The original implementation used Resend's shared `onboarding@resend.dev` sender. Resend silently drops every outbound email whose destination is not the Resend account owner's own email. PR #61 built the custom Worker endpoint; the email delivery failure looked like a product bug, not a Resend policy gotcha. Fix: migrated to Brevo's transactional API (PR #65), which delivers to any inbox with no domain required.

**(b) Brevo click-tracking pre-scanned the link and burned the one-time token.**
Brevo wraps every link as `r.oura.mail.yardendamri.co.il/tr/cl/…` and pre-scans the destination before delivery. The original page called `verifyOtp` on mount, which consumed the single-use recovery token during Brevo's scan GET — before the user ever clicked. Result: first real tap showed "otp_expired". Brevo has NO way to disable click-tracking on transactional email (no per-send flag, no dashboard toggle that actually prevents the scan — "anonymous tracking" still wraps and pre-scans). Fix (PR #71): the confirm gate. The page now shows a "המשך לאיפוס הסיסמה" button and only calls `verifyOtp` when the real user taps it — a prefetch GET can't perform a tap, so the token survives the scan.

**(c) "Found it" — two-client Safari conflict (PR #73, real but secondary).**
A session diagnosed a Safari-specific dual-Supabase-client conflict (PKCE state mismatch between SSR and browser clients) and shipped PR #73 as "the fix." This was a real bug but not the primary cause of the failures seen in production — it was secondary. Shipping it as a definitive fix without confirming the real root cause cost time.

**(d) Actual root cause: `deploy.js` mapped `SUPABASE_URL` (ends in `/rest/v1/`) to `NEXT_PUBLIC_SUPABASE_URL` — browser client called PostgREST instead of GoTrue.**
`apps/web/deploy.js` (the OpenNext build script) was pulling the Worker-side `SUPABASE_URL` — which ends in `/rest/v1/` (the PostgREST base, used for direct table queries) — and baking it into `NEXT_PUBLIC_SUPABASE_URL`, the env var the browser-side Supabase client reads as its project URL. The `@supabase/ssr` browser client uses that URL as the GoTrue base: `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/…`. With `/rest/v1/` appended, every browser-side auth call (including `verifyOtp`) hit PostgREST instead of GoTrue and returned `PGRST125 "Invalid path specified in request URL"`. This silently broke every client-side Supabase auth operation in the deployed bundle, regardless of the actual page code. Fix: `deploy.js` now strips the `/rest/v1/` suffix before baking the URL into the frontend bundle.

**How to find this in 5 seconds next time:**
```
grep -r 'NEXT_PUBLIC_SUPABASE_URL' apps/web/.open-next/assets
```
The value must NOT contain `/rest/v1/`. If it does, `deploy.js` is passing the wrong URL and every browser-side auth call is hitting PostgREST. Check this before debugging any client-side Supabase error — `PGRST125` in the browser console is the tell.

**Standing rule:** always verify the baked-in env vars in the built bundle (`apps/web/.open-next/assets`) before debugging client-side Supabase errors. A misconfigured `NEXT_PUBLIC_SUPABASE_URL` breaks all browser auth silently and leaves confusing PGRST-level errors that look like a GoTrue problem.

---

### 2026-07-14 — Sessions kept randomizing the founder's real account password during auth testing
**What:** The founder's `ofirdamr@gmail.com` password was changed multiple times across sessions (to `TempPass2026!Oura`, etc.) because sessions called the Supabase Admin API or `auth.admin.updateUserById()` directly against the real production account while doing auth testing or debugging. Not a code path in the product — ad-hoc curl/API calls from within sessions.
**Why:** No guardrail existed prohibiting auth mutations against the real account. Sessions treated "I need to test auth" as license to use the service-role key or Management API to change the live founder account, not a throwaway one.
**Correct approach:** Auth testing always uses a throwaway account (different email, delete after test). The only legitimate `auth.updateUser` in the codebase is `apps/web/app/reset-password/page.tsx` — gated behind a `PASSWORD_RECOVERY` session, which is correct. Added a hard CLAUDE.md guardrail prohibiting any auth credential mutation against real accounts. Password is now `OuraStudio2026!` — use `/forgot-password` if lost again, never the admin API.

---
