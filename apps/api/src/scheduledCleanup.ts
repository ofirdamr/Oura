// Daily Cloudflare Cron Trigger: enforce the 30-day retention TTL on stored
// face embeddings (biometric_consents.retention_expires_at, set by migration
// 0003's trigger). Scoped to ONLY delete face_embeddings rows carrying that
// guest's guest_id — never the guests/biometric_consents rows themselves
// (those hold no vector, just consent/audit metadata worth keeping
// indefinitely). Idempotent by construction: re-running against already-
// cleaned rows is a no-op, so no separate "processed" marker is needed.
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

  const { error: deleteErr } = await db
    .from('face_embeddings')
    .delete()
    .in('guest_id', guestIds);
  if (deleteErr) console.error('retention cleanup delete failed', deleteErr);
}
