-- Add multi-tier storage keys JSONB to photos table.
-- Keys: original / desktop / mobile / share / thumb
-- Populated by the CF queue consumer after upload processing.
-- NULL until the tier-generation pipeline runs (backward-compatible: gallery
-- falls back to the legacy storage_key column when storage_keys is NULL).
ALTER TABLE photos ADD COLUMN IF NOT EXISTS storage_keys JSONB;
