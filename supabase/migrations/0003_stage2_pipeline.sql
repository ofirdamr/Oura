-- Oura — migration 0003: Stage 2 face-matching pipeline foundations.
-- Apply via Supabase Management API (POST /v1/projects/:ref/database/query) — service_role
-- JWT cannot run DDL over PostgREST, and direct psql/5432 is unreachable from this sandbox
-- (see MISTAKES.md). Migrations are append-only: 0001/0002 are already live — do NOT edit them.
--
-- Context: 0001_init.sql deliberately left `biometric_consents.retention_expires_at` NULL
-- with no default, pending PRD.md §8's legal review (minors routinely present at weddings).
-- The founder has now received an informal draft legal opinion (formal signed version to
-- follow) and explicitly decided to proceed on that basis, accepting the risk. Its concrete
-- recommendation — a 30-day retention window on stored biometric embeddings — is encoded here.

begin;

-- Retention TTL: 30 days from consent, decided by the founder. Applies to future consents
-- via the trigger; backfills existing NULL rows from live Stage-1 guest consents below.
create or replace function set_retention_expiry()
returns trigger language plpgsql as $$
begin
  if new.retention_expires_at is null then
    new.retention_expires_at := new.consented_at + interval '30 days';
  end if;
  return new;
end $$;

create trigger biometric_consents_set_retention
  before insert on biometric_consents
  for each row execute function set_retention_expiry();

update biometric_consents
set retention_expires_at = consented_at + interval '30 days'
where retention_expires_at is null;

-- Guardian/age confirmation: folded into the existing custom-built /consent screen as an
-- additional required checkbox (per founder decision, avoids a second Stitch design round-trip
-- for a screen that is substantively just one more consent gesture). Enforced server-side in
-- POST /consent/:token, not trusted from the UI alone — same guardrail philosophy as the rest
-- of the consent gate.
alter table biometric_consents
  add column guardian_confirmed boolean not null default false;

-- Photo-processing status, deliberately separate from `photos.status` (upload/visibility
-- lifecycle, must stay untouched — regressing that would hide already-uploaded photos from
-- the general gallery while embedding runs). Purely for pipeline observability/retry.
alter table photos
  add column embed_status text not null default 'pending'
    check (embed_status in ('pending', 'processing', 'done', 'failed'));
create index photos_embed_status_idx on photos (event_id, embed_status);

-- Shared ANN-search RPC: pgvector's `<=>` cosine-distance operator needs a literal vector
-- parameter, unreachable through plain PostgREST/supabase-js filters. Used both by ingestion-
-- time cluster assignment and by the guest selfie match (apps/api/src/pipeline/cluster.ts and
-- the POST /guests/:token/selfie route).
create or replace function match_faces(
  p_event_id uuid, p_query_embedding vector(512), p_match_limit int default 20
) returns table(id uuid, person_id uuid, distance float4)
language sql stable as $$
  select id, person_id, embedding <=> p_query_embedding as distance
  from face_embeddings
  where event_id = p_event_id and person_id is not null
  order by embedding <=> p_query_embedding
  limit p_match_limit
$$;
grant execute on function match_faces(uuid, vector, int) to service_role;

commit;
