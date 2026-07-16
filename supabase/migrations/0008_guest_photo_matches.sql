-- Oura — migration 0008: guest↔photo matches become a MANY-TO-MANY link.
-- Apply via Supabase Management API (POST /v1/projects/:ref/database/query) — service_role
-- JWT cannot run DDL over PostgREST, and direct psql/5432 is unreachable from this sandbox
-- (see MISTAKES.md). Migrations are append-only: 0001-0007 are already live — do NOT edit them.
--
-- Root cause this fixes (the recurring "selfie → 0 מתוך 17" bug):
-- The guest↔photo match was stored as a SINGLE-OWNER stamp — `face_embeddings.guest_id`
-- (+ `match_similarity`) written onto the shared photo-face index rows. But a guest↔photo
-- match is inherently MANY-TO-MANY: the same physical person routinely produces MORE THAN ONE
-- guest session (re-scanning the QR, a new device, an incognito window, a lost session), and
-- every one of those sessions legitimately matches the same person clusters. The single-owner
-- column let the FIRST guest session "claim" a cluster's rows; the selfie UPDATE was guarded
-- with `or(guest_id.is.null, guest_id.eq.<self>)`, so every LATER session matching the same
-- cluster updated 0 rows, returned matched:true anyway, and then read its personal gallery
-- filtered by its own guest_id → 0 photos. Proven live on WED-2024.
--
-- Fix: a dedicated join table. Each (guest, photo) match is its own row, so any number of guest
-- sessions can match the same cluster independently. The shared `face_embeddings` index keeps
-- ONLY the photo-derived data (embedding, person_id cluster); it no longer carries guest links.
-- `face_embeddings.guest_id` / `match_similarity` are left in place (append-only migrations) but
-- are now vestigial — the app reads/writes matches through guest_photo_matches exclusively.

begin;

create table if not exists guest_photo_matches (
  guest_id         uuid        not null references guests(id)  on delete cascade,
  photo_id         uuid        not null references photos(id)  on delete cascade,
  event_id         uuid        not null references events(id)  on delete cascade,
  match_similarity float4,
  created_at       timestamptz not null default now(),
  primary key (guest_id, photo_id)
);

-- Gallery reads by guest; retention forget deletes by guest — both want this index.
create index if not exists guest_photo_matches_guest_idx on guest_photo_matches (guest_id);

-- Guests never touch the DB directly (they go through the Worker with the service role);
-- lock the table down so only service_role — which bypasses RLS — can read/write it.
-- enabled + forced, matching the other guest tables (0001).
alter table guest_photo_matches enable row level security;
alter table guest_photo_matches force row level security;

commit;
