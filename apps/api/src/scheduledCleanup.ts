// Daily Cloudflare Cron Trigger: enforce the 30-day retention TTL on the
// guest<->face LINK (biometric_consents.retention_expires_at, set by migration
// 0003's trigger).
//
// CRITICAL — read before touching this file (see MISTAKES.md 2026-07-09):
// a `face_embeddings` row is NOT the guest's selfie. It is a face detected in
// the PHOTOGRAPHER'S event photo — the shared, searchable index that EVERY
// guest (present and future) matches their selfie against. The guest's own
// selfie/embedding is zero-retention and never stored at all (see the selfie
// route). So the only guest-specific, retention-bound datum here is the
// guest_id LINK stamped onto those shared rows when a match happens — never the
// embedding vector itself.
//
// This job therefore UN-LINKS (nulls guest_id) on expiry; it must NEVER delete
// face_embeddings rows. Deleting them (the original bug) tore the shared match
// index out from under everyone the moment any single guest's 30 days elapsed,
// silently killing face-matching for the whole event until a manual re-embed —
// the "it worked, then disappeared, again" report. Nulling forgets the guest's
// biometric association (what retention is actually for) while leaving the
// photo-derived index intact, so matching keeps working forever.
//
// Idempotent by construction: re-running against already-unlinked rows is a
// no-op. biometric_consents rows are kept (they hold no vector, only
// consent/audit metadata) as the audit record of the (now-expired) consent.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './index';

export async function handleScheduled(
  _event: ScheduledController,
  env: Env,
  supa: (env: Env) => SupabaseClient,
): Promise<void> {
  const db = supa(env);

  const { data: expired, error } = await db
    .from('biometric_consents')
    .select('guest_id')
    .lt('retention_expires_at', new Date().toISOString());
  if (error) {
    console.error('retention cleanup lookup failed', error);
    return;
  }

  const guestIds = (expired ?? []).map((row) => row.guest_id);
  if (guestIds.length === 0) return;

  // Un-link only — forget the guest<->cluster association. NEVER .delete() here:
  // these rows are the shared photo-face index, not the guest's biometric data.
  const { error: unlinkErr } = await db
    .from('face_embeddings')
    .update({ guest_id: null })
    .in('guest_id', guestIds);
  if (unlinkErr) console.error('retention cleanup unlink failed', unlinkErr);
}
