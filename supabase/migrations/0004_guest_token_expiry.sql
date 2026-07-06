-- Oura — migration 0004: guest token expiry.
-- Apply via Supabase Management API (POST /v1/projects/:ref/database/query) — service_role
-- JWT cannot run DDL over PostgREST, and direct psql/5432 is unreachable from this sandbox
-- (see MISTAKES.md). Migrations are append-only: 0001-0003 are already live — do NOT edit them.
--
-- Context: guest tokens never expired (flagged by an earlier security review,
-- docs/ARCHITECTURE.md §8, left unaddressed). Since the token also travels as a literal
-- URL path segment (loggable at proxies/CDNs — a separate, larger fix not attempted here),
-- a single leaked/logged token granted indefinite access to that guest's personal gallery.
-- This adds a hard expiry, enforced in apps/api/src/index.ts's resolveGuest() alongside the
-- existing token_hash lookup (no extra query — same row already fetched). 90 days is chosen
-- to comfortably outlast typical post-event photo browsing (people revisit wedding galleries
-- over weeks/months) while still bounding a leaked token's lifetime, and is a plain column
-- (not re-derived from the token payload) so a photographer/operator can shorten or extend an
-- individual guest's access later without reissuing tokens.

begin;

alter table guests add column token_expires_at timestamptz;
update guests set token_expires_at = created_at + interval '90 days' where token_expires_at is null;
alter table guests alter column token_expires_at set not null;
alter table guests alter column token_expires_at set default (now() + interval '90 days');

commit;
