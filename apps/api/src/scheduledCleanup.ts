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
// This job therefore FORGETS the guest<->photo match links on expiry (deletes the
// guest's rows in the guest_photo_matches join table, migration 0008); it must
// NEVER delete face_embeddings rows. Deleting those (the original bug) tore the
// shared match index out from under everyone the moment any single guest's 30 days
// elapsed, silently killing face-matching for the whole event until a manual
// re-embed — the "it worked, then disappeared, again" report. Forgetting only the
// join rows drops the guest's biometric association (what retention is actually
// for) while leaving the photo-derived index intact, so matching keeps working forever.
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

  // Forget the guest<->photo match links. Since migration 0008 these live in the
  // guest_photo_matches join table — one row per (guest, photo), guest-specific and
  // retention-bound — so deleting this guest's rows is the correct "forget the
  // biometric association" with no shared data at stake. The shared face_embeddings
  // index is NEVER touched here (migration 0005 guard): deleting from the join table
  // leaves every photo's face vectors intact, so matching keeps working forever.
  const { error: forgetErr } = await db
    .from('guest_photo_matches')
    .delete()
    .in('guest_id', guestIds);
  if (forgetErr) console.error('retention cleanup forget failed', forgetErr);
}
