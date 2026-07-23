-- Migration 0013: Holistic (burst + visual clustering) classification support.
--
-- The per-photo zero-shot CLIP classifier judges each frame in isolation, which
-- loses the founder's key insight: wedding photos arrive in bursts at the same
-- place/time, so an ambiguous frame inside a run of confident "couple" frames is
-- almost certainly "couple". These columns let an event-level refine pass reason
-- over ALL of an event's photos together without re-downloading a single image.
--
--   clip_embedding  : L2-normalized CLIP image embedding (jsonb float array) from
--                     the last classification. The visual-clustering refine groups
--                     photos by cosine similarity of these vectors.
--   clip_scores     : raw per-category CLIP similarity scores (jsonb object) from
--                     the last classification. The refine pass pools these across a
--                     cluster to reach a consensus category.
--   category_source : provenance of photos.category —
--                       'ai'      = per-photo CLIP (real-time upload or backfill)
--                       'cluster' = event-level burst/visual-clustering refine
--                       'manual'  = photographer one-tap correction in the dashboard
--                     'manual' ALWAYS wins: the AI and refine passes never overwrite
--                     a photo whose category_source is 'manual'.
alter table photos add column if not exists clip_embedding jsonb;
alter table photos add column if not exists clip_scores jsonb;
alter table photos add column if not exists category_source text
  check (category_source in ('ai', 'cluster', 'manual'));

-- Index the source so the refine pass can cheaply skip manually-corrected photos.
create index if not exists photos_category_source_idx on photos (event_id, category_source)
  where category_source is not null;
