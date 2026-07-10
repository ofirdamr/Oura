-- Mission A — prints & gifts commerce.
-- Adds the orders + order_items tables backing the guest-facing print-purchase
-- flow (premium-prints screen -> Stripe-hosted Checkout -> order-confirmation).
--
-- Ownership/access model mirrors the rest of the guest path: these rows are
-- written and read ONLY through the oura-api Worker's service-role client
-- (which bypasses RLS), gated by the guest's opaque event-scoped token. Guests
-- never touch Postgres directly (CLAUDE.md guardrail). RLS is therefore enabled
-- + FORCED with ZERO policies — exactly like the guest-mediated tables — so a
-- leaked anon key can never read a stranger's order. Photographer-facing order
-- views (seeing orders for one's own events) are a later, additive concern and
-- would get their own `auth.uid()`-keyed SELECT policy then.
--
-- Money is stored in agorot (integer minor units of ILS) — never floats — so
-- arithmetic is exact. `currency` is kept per-order for forward-compatibility
-- even though everything is 'ils' today.

create extension if not exists pgcrypto;

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  guest_id         uuid not null references guests(id) on delete cascade,
  -- Short human-facing order number shown on the confirmation screen (e.g.
  -- OR-98421 in the design). Unique; generated in the Worker with collision retry.
  order_number     text not null unique,
  -- pending  : created, awaiting payment (Stripe Checkout Session opened)
  -- paid     : Stripe confirmed payment (checkout.session.completed webhook)
  -- failed   : Checkout Session expired/failed
  -- cancelled: explicitly cancelled
  -- fulfilled: prints produced/shipped (manual, later)
  status           text not null default 'pending'
                     check (status in ('pending','paid','failed','cancelled','fulfilled')),
  currency         text not null default 'ils',
  subtotal_agorot  integer not null check (subtotal_agorot >= 0),
  shipping_agorot  integer not null default 0 check (shipping_agorot >= 0),
  total_agorot     integer not null check (total_agorot >= 0),
  -- Stripe linkage. session id is the idempotency anchor for the webhook.
  stripe_session_id        text unique,
  stripe_payment_intent    text,
  contact_email    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  -- The gallery photo being printed. Nullable + ON DELETE SET NULL so deleting a
  -- photo later never destroys the historical order record (the line keeps its
  -- denormalized title/spec below).
  photo_id       uuid references photos(id) on delete set null,
  product_type   text not null default 'print' check (product_type in ('print')),
  size           text not null,          -- '10x15' | '13x18' | '20x30'
  paper          text not null,          -- 'matte' | 'glossy' | 'silk'
  frame          text,                   -- 'oak' | 'black' | 'gold' | null (no frame)
  quantity       integer not null default 1 check (quantity >= 1),
  -- Authoritative per-unit + line totals, computed server-side from the pricing
  -- config at checkout time (client-sent amounts are never trusted). Denormalized
  -- so a later pricing change never rewrites a historical order's totals.
  unit_agorot    integer not null check (unit_agorot >= 0),
  line_agorot    integer not null check (line_agorot >= 0),
  title          text not null,          -- Hebrew label snapshot, e.g. 'הדפסת פרימיום 10x15'
  created_at     timestamptz not null default now()
);

create index if not exists orders_event_id_idx on orders (event_id);
create index if not exists orders_guest_id_idx on orders (guest_id);
create index if not exists order_items_order_id_idx on order_items (order_id);

-- Same RLS posture as guests/photos on the guest path: locked to service-role
-- only. Enable AND force (force so even the table owner is subject to policies),
-- and define NO policies — every access goes through the Worker.
alter table orders enable row level security;
alter table orders force row level security;
alter table order_items enable row level security;
alter table order_items force row level security;
