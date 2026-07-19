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
  const t = text.toLowerCase();
  // Use word-boundary test for short keywords that appear as substrings (e.g. "ring" inside "during"/"gathering"/"wearing")
  const hasWord = (w: string) => new RegExp(`(?<![a-z])${w}(?![a-z])`).test(t);
  // ceremony = chuppah / vows / rings / processional — must match before reception
  if (t.includes('ceremony') || t.includes('chuppah') || t.includes('vow') || hasWord('ring') || t.includes('processional') || t.includes('altar')) return 'ceremony';
  // dancing = dance floor / hora / group dancing
  if (t.includes('danc') || t.includes('hora')) return 'dancing';
  // reception = seated dinner / toasts / speeches / meal
  if (t.includes('reception') || t.includes('dinner') || t.includes('toast') || t.includes('speech') || t.includes('seated') || t.includes('meal')) return 'reception';
  // party = general festive celebration not fitting the above
  if (t.includes('party') || t.includes('celebration') || t.includes('festive') || t.includes('cocktail') || t.includes('cake')) return 'party';
  return null;
}

async function classifyCategory(ai: Ai, imageBytes: ArrayBuffer): Promise<string | null> {
  try {
    const result = await (ai as any).run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: [...new Uint8Array(imageBytes)],
      prompt: 'This is a wedding event photo. Classify it into exactly one category and reply with that single word only.\n- "ceremony": chuppah, exchanging vows, ring exchange, wedding processional, officiant at altar\n- "reception": seated dinner, toasts, speeches, guests at tables eating a meal\n- "dancing": dance floor, hora, group dancing, first dance\n- "party": general festive celebration, cocktail hour, cake cutting, confetti — anything not fitting the above three\nReply with one word only.',
      max_tokens: 50,
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

      message.ack();
    } catch (err) {
      console.error('face-embed failed for photo', photo_id, err);
      await db.from('photos').update({ embed_status: 'failed' }).eq('id', photo_id);
      message.retry();
    }
  }
}
