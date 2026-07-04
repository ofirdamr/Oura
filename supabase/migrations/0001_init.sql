-- Oura — initial schema (MVP guest/photographer flow)
-- Apply via Supabase Studio → SQL Editor (the anon/service_role JWTs cannot run DDL over PostgREST).
-- Scope: only the MVP tables backing the guest gallery + photographer event flow.
-- Deliberately NOT included (Phase 2, per PRD.md §4): Stripe billing, print orders,
-- commission ledger, statistics, messaging, notification/moderation queues.
--
-- Security model (see CLAUDE.md guardrails):
--   * Guests never authenticate. All guest-facing reads go through the Cloudflare
--     Worker, which holds the service_role key (bypasses RLS) and validates an
--     opaque, signed, event-scoped token. The browser never gets the anon or
--     service key. We therefore define NO policies for the `anon` role — with RLS
--     enabled and force-enabled, the anon key is denied on every table by default.
--   * Photographers are real Supabase Auth users. RLS grants each of them access
--     to ONLY their own events' rows, keyed on auth.uid().
--   * Media binaries live in Cloudflare R2 only — `photos` stores object keys, never bytes.

begin;

-- Extensions -----------------------------------------------------------------
create extension if not exists vector;      -- pgvector: self-hosted InsightFace/ArcFace embeddings
create extension if not exists pgcrypto;    -- gen_random_uuid()

-- updated_at helper ----------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- events ---------------------------------------------------------------------
-- Photographer-owned. One row per event (wedding, party, ...).
create table events (
  id              uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          text not null default 'draft'
                    check (status in ('draft', 'live', 'archived')),
  -- Visual theme of the shared gallery (from the Stitch design). The per-guest
  -- face-matched "personal" view is a client mode, not an event theme.
  gallery_theme   text not null default 'festive'
                    check (gallery_theme in ('festive', 'minimal')),
  -- logo / frame / watermark / color config — flexible for MVP, no binaries here.
  branding        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index events_photographer_id_idx on events (photographer_id);

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- guests ---------------------------------------------------------------------
-- Event-scoped guest session. NOT a Supabase Auth user (CLAUDE.md: guests never
-- log in). Backed by an opaque signed token issued by the Worker; we store only
-- a hash of that token, never the token itself, and never guest PII beyond an
-- optional self-set display name.
create table guests (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events (id) on delete cascade,
  token_hash    text not null,          -- SHA-256 of the opaque event-scoped token
  display_name  text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (event_id, token_hash)
);
create index guests_event_id_idx on guests (event_id);

-- photos ---------------------------------------------------------------------
-- R2 object references ONLY. No binary data ever lands in Postgres/Supabase
-- storage (CLAUDE.md guardrail). `storage_key` is the R2 object key in `ouramedia`.
create table photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events (id) on delete cascade,
  storage_key   text not null,          -- R2 object key, e.g. events/<event_id>/orig/<uuid>.jpg
  status        text not null default 'uploaded'
                  check (status in ('uploaded', 'processing', 'ready', 'failed', 'culled')),
  width         int,
  height        int,
  bytes         bigint,
  content_type  text,
  phash         text,                   -- perceptual hash for dedup/cull
  captured_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (event_id, storage_key)
);
create index photos_event_id_idx on photos (event_id);
create index photos_status_idx on photos (event_id, status);

-- face_embeddings ------------------------------------------------------------
-- One row per detected face. Vectors come from the self-hosted InsightFace/ArcFace
-- pipeline (never a per-call managed API — CLAUDE.md). ArcFace outputs 512-dim.
-- `person_id` is an opaque cluster id (grouping faces of the same person); it is
-- NOT raw PII. `guest_id` links a cluster to a guest session once that guest's
-- consented selfie matches the cluster.
create table face_embeddings (
  id              uuid primary key default gen_random_uuid(),
  photo_id        uuid not null references photos (id) on delete cascade,
  event_id        uuid not null references events (id) on delete cascade,  -- denormalized for RLS/query scoping
  person_id       uuid,               -- cluster id (assigned by the pipeline)
  guest_id        uuid references guests (id) on delete set null,
  embedding       vector(512) not null,
  bbox            jsonb,              -- face bounding box within the photo
  detection_score real,
  created_at      timestamptz not null default now()
);
create index face_embeddings_event_id_idx on face_embeddings (event_id);
create index face_embeddings_person_id_idx on face_embeddings (person_id);
create index face_embeddings_photo_id_idx on face_embeddings (photo_id);
-- ANN index for similarity search (cosine). HNSW needs no training pass, unlike ivfflat.
create index face_embeddings_embedding_idx
  on face_embeddings using hnsw (embedding vector_cosine_ops);

-- biometric_consents ---------------------------------------------------------
-- Face-matching MUST NOT run before a row exists here (CLAUDE.md consent gate).
-- IMPORTANT: retention_expires_at is intentionally NULLABLE with NO default.
-- The biometric consent/retention policy is an OPEN, unresolved legal question
-- (PRD.md §8 — minors are routinely present at weddings). Do NOT add a default
-- or assume a duration: a placeholder here would be mistaken downstream for a
-- real, legally-reviewed policy decision. NULL == "retention window not yet
-- decided". Backfill only once legal sign-off exists.
create table biometric_consents (
  id                  uuid primary key default gen_random_uuid(),
  guest_id            uuid not null references guests (id) on delete cascade,
  event_id            uuid not null references events (id) on delete cascade,
  consented_at        timestamptz not null default now(),
  retention_expires_at timestamptz,   -- see note above: no default, policy undecided
  created_at          timestamptz not null default now(),
  unique (guest_id)
);
create index biometric_consents_event_id_idx on biometric_consents (event_id);

-- Row Level Security ---------------------------------------------------------
-- Enable + FORCE on every table. No `anon` policies exist, so the anon key is
-- denied everywhere. The Worker uses service_role, which bypasses RLS entirely.
alter table events             enable row level security;
alter table guests             enable row level security;
alter table photos             enable row level security;
alter table face_embeddings    enable row level security;
alter table biometric_consents enable row level security;

alter table events             force row level security;
alter table guests             force row level security;
alter table photos             force row level security;
alter table face_embeddings    force row level security;
alter table biometric_consents force row level security;

-- events: a photographer sees/writes only their own events.
create policy events_owner_select on events
  for select to authenticated using (photographer_id = auth.uid());
create policy events_owner_insert on events
  for insert to authenticated with check (photographer_id = auth.uid());
create policy events_owner_update on events
  for update to authenticated
  using (photographer_id = auth.uid()) with check (photographer_id = auth.uid());
create policy events_owner_delete on events
  for delete to authenticated using (photographer_id = auth.uid());

-- Child tables: access allowed only when the row's event belongs to the caller.
create policy guests_owner_all on guests
  for all to authenticated
  using (exists (select 1 from events e where e.id = guests.event_id and e.photographer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = guests.event_id and e.photographer_id = auth.uid()));

create policy photos_owner_all on photos
  for all to authenticated
  using (exists (select 1 from events e where e.id = photos.event_id and e.photographer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = photos.event_id and e.photographer_id = auth.uid()));

create policy face_embeddings_owner_all on face_embeddings
  for all to authenticated
  using (exists (select 1 from events e where e.id = face_embeddings.event_id and e.photographer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = face_embeddings.event_id and e.photographer_id = auth.uid()));

create policy biometric_consents_owner_all on biometric_consents
  for all to authenticated
  using (exists (select 1 from events e where e.id = biometric_consents.event_id and e.photographer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = biometric_consents.event_id and e.photographer_id = auth.uid()));

commit;
