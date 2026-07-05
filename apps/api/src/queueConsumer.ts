// Cloudflare Queue consumer: photo-side face embedding + clustering.
// Triggered by an enqueue in POST /events/:event_id/photos. Never blocks the
// upload response — this runs asynchronously, independent of it.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './index';
import { embed } from './pipeline/embedClient';
import { assignPersonId } from './pipeline/cluster';

export type PhotoEmbedMessage = {
  photo_id: string;
  event_id: string;
  storage_key: string;
};

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

      const faces = await embed(bytes, {
        EMBED_SERVICE_URL: env.EMBED_SERVICE_URL,
        EMBED_SERVICE_TOKEN: env.EMBED_SERVICE_TOKEN,
      });

      const threshold = Number(env.CLUSTER_MATCH_THRESHOLD ?? '0.5');
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
      }

      await db.from('photos').update({ embed_status: 'done' }).eq('id', photo_id);
      message.ack();
    } catch (err) {
      console.error('face-embed failed for photo', photo_id, err);
      await db.from('photos').update({ embed_status: 'failed' }).eq('id', photo_id);
      message.retry();
    }
  }
}
