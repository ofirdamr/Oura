# SERVICES SURVEY — free-tier / cost comparison

Not architecture — a standalone survey of what each external service costs Oura, so we can keep picking the leanest option. Reference doc; update when volume assumptions or pricing change.

## Reference volume ("walking" / steady, not pilot)
- 1 photographer
- 5 events / month
- ~300 guests / event average → 1,500 guests/month
- ~60% of guests take a selfie → ~900 selfies/month
- ~800 photos / event → ~4,000 photos/month
- ~3 faces/photo average → ~12,000 face calculations from photos
- **Total face calculations ≈ 13,000 / month** (900 selfies + 12,000 photo faces)

## Per-service verdict at that volume

| Service | Role | Free tier | Our usage | Verdict |
|---|---|---|---|---|
| **Google Cloud Run** | Face-matching "brain" (creates fingerprints) | ~2M requests, 180,000 vCPU-sec, 360,000 GiB-sec / month | ~13,000 calculations ≈ <10% of allowance | **Free** — *only if set to scale-to-zero (min instances = 0)*. Min=1 (always-on) bills 24/7 and breaks free. |
| **Supabase** | Stores face fingerprints (pgvector) + DB/Auth | 500 MB database | ~25 MB/month of vectors+metadata | **Free for well over a year** before 500 MB fills. First paid step: Pro $25/mo, or prune old events. |
| **Cloudflare R2** | Stores all photos/videos (media) | 10 GB storage, **zero egress fees**, 1M/10M ops | ~12 GB/month of photos, accumulating | **First to cost** — past 10 GB it's ~$0.015/GB-month (a few shekels, growing). Chosen because viewing/downloading is free; every other host bills heavily for egress. |

## Takeaways
- Face-matching (Cloud Run) and fingerprints (Supabase) stay **free** at working volume.
- The only real, unavoidable cost is **stored media on R2**, and it's the cheapest option precisely because R2 charges nothing for guests viewing/downloading.
- Guardrail to stay free on Cloud Run: keep **scale-to-zero** (accept a few seconds of cold-start latency instead of paying for always-on).

_Numbers are order-of-magnitude estimates for planning, not a billing guarantee. Revisit if per-event photo counts or event frequency change materially._
