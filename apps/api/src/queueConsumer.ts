// Cloudflare Queue consumer: photo-side face embedding + clustering + AI pipeline.
// Triggered by an enqueue in POST /events/:event_id/photos. Never blocks the
// upload response — this runs asynchronously, independent of it.
//
// Pipeline steps per photo (in order):
//   1. Face embedding via Cloud Run InsightFace service
//   2. Closed-eye / low-quality detection (detection_score heuristic)
//   3. Duplicate detection (cosine similarity against existing cluster embeddings)
//   4. Category auto-labeling via Cloudflare Workers AI (LLaVA vision model)
//   5. Persist results: face_embeddings rows + update photos columns
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './index';
import { embedWithRetry } from './pipeline/embedClient';
import { assignPersonId } from './pipeline/cluster';

export type PhotoEmbedMessage = {
  photo_id: string;
  event_id: string;
  storage_key: string;
};

// Cosine similarity between two L2-normalized embedding vectors.
function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function parseCategory(text: string): string | null {
  const t = text.toLowerCase().trim();
  // Score each category by how many of its keywords appear
  const score = (words: string[]) => words.filter(w => t.includes(w)).length;
  const ceremonyScore = score(['canopy', 'arch', 'chuppah', 'vow', 'altar', 'officiant', 'rabbi', 'bride', 'groom', 'glass', 'breaking', 'processional', 'aisle', 'wedding ceremony', 'marriage ceremony']);
  const dancingScore = score(['danc', 'hora', 'dance floor', 'first dance', 'circle', 'spinning', 'jumping']);
  const receptionScore = score(['kabbalat', 'cocktail', 'mingle', 'mingling', 'appetizer', 'waiter', 'serving', 'station', 'reception area', 'before the ceremony']);
  const partyScore = score(['seated', 'dinner', 'table', 'meal', 'eating', 'toast', 'speech', 'banquet', 'celebrating at table']);

  const best = Math.max(ceremonyScore, dancingScore, receptionScore, partyScore);
  if (best === 0) return null; // genuinely unrecognizable — don't guess
  if (ceremonyScore === best) return 'ceremony';
  if (dancingScore === best) return 'dancing';
  if (receptionScore === best) return 'reception';
  if (partyScore === best) return 'party';
  return null;
}

async function classifyCategory(ai: Ai, imageBytes: ArrayBuffer): Promise<string | null> {
  try {
    const result = await (ai as any).run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: [...new Uint8Array(imageBytes)],
      prompt: 'Look at this Jewish/Israeli wedding photo. Describe only what you literally see in 1-2 sentences. Focus on: (1) Ceremony (chuppah): canopy or arch, bride and groom underneath, rows of chairs with seated guests watching, aisle/carpet, rabbi, glass-breaking, processional — the whole ceremony area. (2) Reception (kabbalat panim): cocktail-style area before the ceremony — waiters serving food and drinks, people mingling with small appetizer stations, no seating arrangement. (3) Dancing: hora circle, dance floor, group dancing. (4) Party: formal seated dinner tables with full meals, toasts, speeches.',
      max_tokens: 100,
    }) as { description?: string } | null;
    if (!result?.description) return null;
    return parseCategory(result.description);
  } catch (err) {
    console.error('category classification failed:', err);
    return null;
  }
}

async function isDuplicate(
  db: SupabaseClient,
  event_id: string,
  photo_id: string,
  embedding: number[],
  person_id: string,
): Promise<boolean> {
  const { data } = await db
    .from('face_embeddings')
    .select('photo_id, embedding')
    .eq('event_id', event_id)
    .eq('person_id', person_id)
    .neq('photo_id', photo_id);

  if (!data || data.length === 0) return false;

  const DEDUP_THRESHOLD = 0.97;
  for (const row of data) {
    if (!row.embedding) continue;
    if (cosineSim(embedding, row.embedding as number[]) > DEDUP_THRESHOLD) return true;
  }
  return false;
}

export async function handleQueue(
  batch: MessageBatch<PhotoEmbedMessage>,
  env: Env,
  supa: (env: Env) => SupabaseClient,
): Promise<void> {
  const db = supa(env);

  for (const message of batch.messages) {
    const { photo_id, event_id, storage_key } = message.body;
    try {
      await db.from('photos').update({ embed_status: 'processing' }).eq('id', photo_id);

      const object = await env.MEDIA.get(storage_key);
      if (!object) throw new Error('r2_object_missing');
      const bytes = await object.arrayBuffer();

      const faces = await embedWithRetry(bytes, {
        EMBED_SERVICE_URL: env.EMBED_SERVICE_URL,
        EMBED_SERVICE_TOKEN: env.EMBED_SERVICE_TOKEN,
      });

      // ── Quality / closed-eye rejection ───────────────────────────────────
      // Photos with faces where ALL detected faces score < 0.70 are flagged as
      // closed-eyes/blurry. Photos with no faces (decor, landscapes) are kept.
      const QUALITY_THRESHOLD = 0.70;
      let ai_rejected = false;
      let rejection_reason: string | null = null;

      if (faces.length > 0 && faces.every((f) => f.detection_score < QUALITY_THRESHOLD)) {
        ai_rejected = true;
        rejection_reason = 'closed_eyes';
      }

      // ── Face embedding + cluster assignment ──────────────────────────────
      const threshold = Number(env.CLUSTER_MATCH_THRESHOLD ?? '0.5');
      const insertedEmbeddings: Array<{ embedding: number[]; person_id: string }> = [];

      for (const face of faces) {
        const person_id = await assignPersonId(db, event_id, face.embedding, threshold);
        await db.from('face_embeddings').insert({
          photo_id,
          event_id,
          person_id,
          embedding: face.embedding,
          bbox: face.bbox,
          detection_score: face.detection_score,
        });
        insertedEmbeddings.push({ embedding: face.embedding, person_id });
      }

      // ── Duplicate detection ───────────────────────────────────────────────
      if (!ai_rejected && insertedEmbeddings.length > 0) {
        for (const { embedding, person_id } of insertedEmbeddings) {
          if (await isDuplicate(db, event_id, photo_id, embedding, person_id)) {
            ai_rejected = true;
            rejection_reason = 'duplicate';
            break;
          }
        }
      }

      // ── Category classification via Workers AI ────────────────────────────
      const category = await classifyCategory(env.AI, bytes);

      // ── Persist all pipeline results ──────────────────────────────────────
      await db.from('photos').update({
        embed_status: 'done',
        ai_rejected,
        rejection_reason: ai_rejected ? rejection_reason : null,
        category,
      }).eq('id', photo_id);

      // ── Back-match existing guests against this new photo ─────────────────
      // Guests who scanned their selfie BEFORE this photo was uploaded will
      // never see it unless we explicitly link them here. For each person_id
      // detected in this photo, find all guests in this event who already have
      // a guest_photo_matches row that references that same person_id (via
      // face_embeddings), and create a new row for this photo.
      if (!ai_rejected && insertedEmbeddings.length > 0) {
        const personIds = [...new Set(insertedEmbeddings.map((e) => e.person_id))];
        // Find (guest_id, person_id) pairs where the guest previously matched
        // any of these clusters in this event.
        const { data: existingLinks } = await db
          .from('guest_photo_matches')
          .select('guest_id, match_similarity, face_embeddings!inner(person_id)')
          .eq('event_id', event_id)
          .in('face_embeddings.person_id', personIds);

        if (existingLinks && existingLinks.length > 0) {
          // Build guest_id → best similarity for the matched person_ids.
          const simByGuest = new Map<string, number | null>();
          for (const row of existingLinks as Array<{
            guest_id: string;
            match_similarity: number | null;
            face_embeddings: { person_id: string } | { person_id: string }[] | null;
          }>) {
            const fe = Array.isArray(row.face_embeddings) ? row.face_embeddings[0] : row.face_embeddings;
            if (!fe || !personIds.includes(fe.person_id)) continue;
            const prev = simByGuest.get(row.guest_id);
            const sim = row.match_similarity ?? null;
            if (prev === undefined || (sim !== null && (prev === null || sim > prev))) {
              simByGuest.set(row.guest_id, sim);
            }
          }
          const newLinks = Array.from(simByGuest.entries()).map(([guest_id, sim]) => ({
            guest_id,
            event_id,
            photo_id,
            match_similarity: sim,
          }));
          if (newLinks.length > 0) {
            const { error: backMatchErr } = await db
              .from('guest_photo_matches')
              .upsert(newLinks, { onConflict: 'guest_id,photo_id' });
            if (backMatchErr) console.error('back-match upsert failed', photo_id, backMatchErr);
          }
        }
      }

      message.ack();
    } catch (err) {
      console.error('face-embed failed for photo', photo_id, err);
      await db.from('photos').update({ embed_status: 'failed' }).eq('id', photo_id);
      message.retry();
    }
  }
}
