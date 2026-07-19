-- Migration 0010: Stage 2 original-upload tracking
-- Adds is_original_uploaded flag to photos so the dashboard can track which
-- photos still need their high-res original synced from the studio (PRD §10.1).

alter table public.photos
  add column if not exists is_original_uploaded boolean not null default false;

create index if not exists photos_pending_original_idx
  on public.photos (event_id, is_original_uploaded)
  where is_original_uploaded = false;
