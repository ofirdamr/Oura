-- Sprint 1: track deferred high-res original upload per photo (PRD §10.1)
-- Stage 1 upload sets is_original_uploaded = false (web-optimised tier only).
-- Stage 2 "Sync Originals" toggles it to true once the full-res file lands.

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS is_original_uploaded BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: fast lookup of pending-sync photos per event
CREATE INDEX IF NOT EXISTS idx_photos_pending_sync
  ON public.photos (event_id, is_original_uploaded)
  WHERE is_original_uploaded = FALSE;

COMMENT ON COLUMN public.photos.is_original_uploaded IS
  'False until the Tier-1 (original) file is synced back from studio. '
  'Gallery is live from Stage 1 while this is false.';
