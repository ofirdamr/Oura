-- Migration 0006: add match_similarity to face_embeddings
-- Stores the cosine-similarity score (0..1) at the moment a guest selfie
-- links a cluster to a guest, so the gallery API can surface per-photo
-- confidence badges without re-computing the distance later.
alter table face_embeddings
  add column if not exists match_similarity float4;
