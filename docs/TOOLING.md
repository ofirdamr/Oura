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
| **Stripe** (MCP connector) | Real payment/checkout tooling (create products/prices/customers, run checkout) for the prints & gifts commerce mission | CLAUDE.md already picks Stripe as the payment provider; authorizing it lets the team build and TEST the print/gift checkout against real Stripe instead of stubbing. Found via tooling-scout net search 2026-07-08 (registry uuid `de127013-63f1-43d0-8dd2-b6cb5b4e5d1b`, server `facba0b0-…`, currently "requires authentication"). Enable in claude.ai → Connectors. |

### Noted, not a connector (surface when the mission starts)
- **Gift/print fulfillment** (canvas, wood, keychain, phone case): the standard is a print-on-demand REST API — **Printful** or **Printify** — integrated server-side from the Worker (not an MCP connector). Pick one when the prints mission is scheduled. (Web-search confirmation was rate-limited on 2026-07-08; based on domain knowledge.)
- **Canva** MCP is available/enabled but NOT adopted — Oura runs all new visual design through Stitch (locked CLAUDE.md rule), so Canva's design-generation doesn't fit.

## Adopted (scout did this autonomously — no action needed)
<!-- scout appends: date | tool | what it replaced -->
_(none yet)_
