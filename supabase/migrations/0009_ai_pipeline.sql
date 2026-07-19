-- Migration 0009: AI pipeline columns — category auto-labeling, closed-eye/dedup filtering.
-- Applies on top of 0008_guest_photo_matches.sql.

-- Category auto-assigned by the queue consumer via Workers AI image classification.
-- Null = not yet classified (photos uploaded before this migration, or pipeline pending).
alter table photos
  add column if not exists category text
    check (category in ('ceremony', 'reception', 'party', 'dancing'));

-- AI-filtered photos: closed eyes, duplicates, low quality. Rejected photos are
-- hidden from the guest gallery but preserved in R2 and visible to the photographer
-- on the AI Optimization / Reports Management admin screens for review.
alter table photos
  add column if not exists ai_rejected boolean not null default false;

alter table photos
  add column if not exists rejection_reason text
    check (rejection_reason in ('closed_eyes', 'duplicate', 'low_quality', 'blurry'));

-- Index: fast query for the photographer review screen (all rejected photos per event).
create index if not exists photos_ai_rejected_idx on photos (event_id, ai_rejected)
  where ai_rejected = true;

-- Index: category filter for the festive gallery chips.
create index if not exists photos_category_idx on photos (event_id, category)
  where category is not null;
