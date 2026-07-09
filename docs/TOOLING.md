# Tooling Ledger

Maintained by the `tooling-scout` agent. This is how tool adoption survives
across conversations so nothing the scout finds is ever lost.

## How it works
- **Skills / plugins (files):** the scout adopts these itself — no founder
  action. It just adds them and notes it under "Adopted" below.
- **MCP servers / connectors that need a one-time login (OAuth):** the scout
  CANNOT click "Allow" in a browser from a background session — that's the only
  real wall. It records them under "Needs one-time founder login" with the exact
  value and the exact step. The founder does that login **once, ever**; after
  that the whole team uses the connector independently with no further asks.

## Needs one-time founder login (do these once, whenever you're at claude.ai)
_Step for every item: claude.ai → Settings → Connectors → enable it. Or in an
interactive CLI: `/mcp`. Then it's authorized for good._

<!-- scout appends items here: | tool | what it saves | why it fits Oura | -->
_(none open — Stripe was authorized by the founder 2026-07-09; see Adopted below.)_

### Noted, not a connector (surface when the mission starts)
- **Gift/print fulfillment** (canvas, wood, keychain, phone case): the standard is a print-on-demand REST API — **Printful** or **Printify** — integrated server-side from the Worker (not an MCP connector). Pick one when the prints mission is scheduled. (Web-search confirmation was rate-limited on 2026-07-08; based on domain knowledge.)
- **Canva** MCP is available/enabled but NOT adopted — Oura runs all new visual design through Stitch (locked CLAUDE.md rule), so Canva's design-generation doesn't fit.

## Adopted (scout did this autonomously — no action needed)
<!-- scout appends: date | tool | what it replaced -->
- **2026-07-09 | Stripe MCP connector** — authorized by the founder for the
  prints & gifts commerce mission (A). The `mcp__Stripe__*` tools are live
  in-session (create/read products, prices, checkout sessions, refunds, raw
  API read/write, docs search). Mode (test vs live) is UNVERIFIED — the
  founder declined the `get_stripe_account_info` probe on 2026-07-09; the
  build session must confirm TEST mode (or use explicit `sk_test_` keys)
  before writing any charge/checkout code. Replaced: the plan to stub the
  checkout.
