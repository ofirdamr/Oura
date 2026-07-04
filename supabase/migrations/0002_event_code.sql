-- Oura — migration 0002: human-shareable event code.
-- Apply via Supabase Studio → SQL Editor (service_role JWT cannot run DDL over PostgREST).
-- Migrations are append-only: 0001_init.sql is already applied to the live DB — do NOT edit it.
--
-- `events.code` is the short, human-shareable event code (e.g. WED-2024) used for
-- manual entry / QR deeplinks — distinct from the internal UUID `events.id`.

begin;

alter table events add column code text;

-- Partial unique index: events without a code are not forced to have one, but any
-- code that IS set must be globally unique (so by-code lookup resolves to one event).
create unique index events_code_idx on events (code) where code is not null;

commit;
