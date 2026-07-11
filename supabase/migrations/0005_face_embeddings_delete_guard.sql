-- Oura — migration 0005: DB-level guard so face_embeddings can never be
-- per-guest-deleted again.
-- Apply via Supabase Management API (POST /v1/projects/:ref/database/query) — service_role
-- JWT cannot run DDL over PostgREST, and direct psql/5432 is unreachable from this sandbox
-- (see MISTAKES.md). Migrations are append-only: 0001-0004 are already live — do NOT edit them.
--
-- Context — the recurring "face-matching works, then dies after a day" incident
-- (MISTAKES.md 2026-07-09, SUMMARY.md FACE-MATCH block): the daily 3am retention
-- cron used to `.delete()` face_embeddings rows for any expired-consent guest.
-- But a face_embeddings row is NOT the guest's selfie — it is a face detected in
-- the PHOTOGRAPHER'S event photo, i.e. the SHARED, searchable index every guest
-- matches against. Deleting those rows to "clean up" one guest tore the whole
-- event's match index out from under everyone. The app code was fixed to UNLINK
-- (set guest_id = null) instead of delete, but nothing at the DB level prevented
-- a future careless delete from doing it again. This migration makes it
-- structurally impossible.
--
-- The rule we encode: a face_embeddings row may only be DELETED as part of
-- removing its parent photo (the photo genuinely goes away), OR through an
-- explicit, audited operator opt-in (the force re-embed path). Any other delete —
-- notably a guest-scoped cleanup while the photos still exist — is rejected.
--
-- Two legitimate delete paths, both preserved:
--   1. Photo deletion. `face_embeddings.photo_id` is `references photos(id) on
--      delete cascade` (0001). When a photo row is deleted, the cascade removes
--      its faces. Inside that cascade the parent photo is already invisible to
--      this trigger's snapshot (it was deleted earlier in the same transaction),
--      so `not exists (... from photos ...)` is true and the delete is allowed.
--   2. Force re-embed (`POST /admin/backfill-embeddings` with force=true) clears a
--      photo's existing faces before re-inserting. The photo still exists there,
--      so it routes through admin_clear_faces_for_photos() below, which sets the
--      opt-in flag for exactly that transaction.
-- The retention cron's old delete (photos intact, no flag) hits neither path and
-- is rejected loudly instead of silently wiping the index.
begin;

-- Session/transaction-local opt-in flag. A custom (namespaced) GUC needs no
-- special privilege to set; `set local` scopes it to the current transaction, so
-- it can never leak to an unrelated connection in the pooler.
create or replace function guard_face_embeddings_delete()
returns trigger
language plpgsql as $$
begin
  -- Explicit operator opt-in (force re-embed via admin_clear_faces_for_photos).
  if current_setting('oura.allow_face_delete', true) is not distinct from 'on' then
    return old;
  end if;

  -- Genuine photo removal: the parent photo is gone (real ON DELETE CASCADE).
  if not exists (select 1 from photos p where p.id = old.photo_id) then
    return old;
  end if;

  -- Anything else — e.g. a guest-scoped cleanup while the photo still exists — is
  -- the exact bug this guard exists to stop. Unlink (set guest_id = null) instead.
  raise exception
    'face_embeddings rows are the shared photo-face index and must not be deleted while their photo (%) still exists; unlink (guest_id = null) instead. See migration 0005.',
    old.photo_id
    using errcode = 'raise_exception';
end;
$$;

drop trigger if exists face_embeddings_delete_guard on face_embeddings;
create trigger face_embeddings_delete_guard
  before delete on face_embeddings
  for each row execute function guard_face_embeddings_delete();

-- The one sanctioned way to bulk-delete faces for photos that still exist: used by
-- the force re-embed path (clear-then-reinsert). SECURITY DEFINER + a locked-down
-- search_path so the opt-in flag is set in the same transaction as the delete.
create or replace function admin_clear_faces_for_photos(p_photo_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp as $$
declare
  deleted_count integer;
begin
  perform set_config('oura.allow_face_delete', 'on', true); -- true = transaction-local
  delete from face_embeddings where photo_id = any(p_photo_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function admin_clear_faces_for_photos(uuid[]) to service_role;

commit;
