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
_(none yet)_

## Adopted (scout did this autonomously — no action needed)
<!-- scout appends: date | tool | what it replaced -->
_(none yet)_
