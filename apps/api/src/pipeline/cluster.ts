// Streaming greedy nearest-neighbor cluster assignment for photo-side face
// embeddings. Deliberately the simplest thing that's still correct at pilot
// scale (dozens of guests, hundreds of photos per event) — no offline batch
// reclustering job, assignment happens inline as each face is embedded.
//
// Threshold is intentionally conservative (higher bar to merge than the guest
// match threshold in the selfie route) because the failure modes are
// asymmetric: over-merging two different people into one cluster is a privacy
// problem (guest A's selfie could surface guest B's photos); over-splitting
// one person into two clusters is just an availability nuisance, and the
// guest-match route's top-K multi-cluster linking compensates for that for free.
import type { SupabaseClient } from '@supabase/supabase-js';

type MatchRow = { id: string; person_id: string | null; distance: number };

export async function assignPersonId(
  db: SupabaseClient,
  event_id: string,
  embedding: number[],
  threshold: number,
): Promise<string> {
  const { data } = await db.rpc('match_faces', {
    p_event_id: event_id,
    p_query_embedding: embedding,
    p_match_limit: 1,
  });
  const nearest = (data as MatchRow[] | null)?.[0];
  if (nearest?.person_id && 1 - nearest.distance >= threshold) {
    return nearest.person_id;
  }
  return crypto.randomUUID();
}
