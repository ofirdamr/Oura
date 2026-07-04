import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Bindings & secrets available on the Worker env.
// Secrets are injected via `wrangler secret put` — never hardcoded (CLAUDE.md).
export type Env = {
  MEDIA: R2Bucket;
  ENVIRONMENT?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

// Service-role Supabase client. Bypasses RLS — lives ONLY inside the Worker,
// never exposed to the browser. Guest access is mediated here behind an opaque
// event-scoped token, so guests never touch Postgres directly (CLAUDE.md guardrail).
function supa(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Health check — confirms the Worker is live and reports which bindings/secrets
// are wired, without ever leaking their values.
app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'oura-api',
    environment: c.env.ENVIRONMENT ?? 'unknown',
    bindings: {
      media_r2: typeof c.env.MEDIA?.get === 'function',
      supabase_url: Boolean(c.env.SUPABASE_URL),
      supabase_service_key: Boolean(c.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    time: new Date().toISOString(),
  });
});

// Guest gallery (stub). Real token issuance/validation is separate follow-up work.
// The shape is here so the frontend can wire against a stable contract: the guest
// presents an opaque event-scoped token; the Worker (not the browser) resolves it.
app.get('/gallery/:token', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'missing_token' }, 400);

  // TODO(follow-up): verify the signed token, hash it, look up guests by
  // (event_id, token_hash), enforce the biometric-consent gate before any
  // face-matched results, then return event branding + photo R2 URLs.
  return c.json(
    {
      ok: true,
      stub: true,
      message: 'gallery endpoint stub — token validation not yet implemented',
      token_received: true,
    },
    501,
  );
});

app.get('/', (c) => c.text('oura-api'));

export default app;
