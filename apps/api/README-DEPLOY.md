# oura-api — deploy notes

Cloudflare Worker (Hono) for the Oura backend. Live URL:
`https://oura-api.oura-events.workers.dev`

## Secrets (never in git / wrangler.toml)

Set via Wrangler secrets:

```bash
# CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID must be in the environment.
printf %s "$SUPABASE_URL"              | npx wrangler secret put SUPABASE_URL
printf %s "$SUPABASE_SERVICE_ROLE_KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

The service_role key bypasses Postgres RLS and lives ONLY on the Worker. It is
never shipped to the browser. Guests reach data through signed event-scoped
tokens the Worker resolves server-side.

## Deploy

```bash
npm install
npx wrangler deploy
```

## Bindings

- `MEDIA` → R2 bucket `ouramedia` (existing).
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## DB schema

The Postgres schema is `../../supabase/migrations/0001_init.sql`. It has NOT been
applied automatically — the available Supabase keys are PostgREST JWTs and cannot
run DDL. Paste that file into Supabase Studio → SQL Editor and run it once.
