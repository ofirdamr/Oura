"""Event-level holistic category refine — burst + visual clustering.

Pure, torch-free logic (numpy only) so it can be unit-tested without loading the
CLIP/InsightFace models. `main.py` imports `refine_event` and exposes it via the
`/refine-categories` endpoint.

Per-photo CLIP judges each frame alone, throwing away the founder's key insight:
wedding photos come in bursts at the same place/time, so an ambiguous frame inside
a run of confident "couple" frames is almost certainly "couple", and a whole tight
visual cluster shot in one spot is almost certainly one category. This pass reasons
over ALL of an event's photos at once — no image re-download, it works purely on the
stored embeddings + raw scores — and is category-agnostic (it argmaxes over whatever
`category_keys` the caller sends, so it works equally for a 4- or 7-category model).
"""
from typing import Optional

import numpy as np

# Cosine similarity at/above which two photos are treated as the same visual scene
# (a burst). ViT-L/14 image embeddings for near-duplicate/same-setup frames sit
# well above this; distinct scenes fall below it.
CLUSTER_SIM = 0.86
# A confident per-photo classification only gets overridden by its cluster when the
# cluster is a real burst of at least this many photos — protects a genuinely
# distinct confident shot that happens to sit in a loose pair.
MIN_CLUSTER_OVERRIDE = 3


def refine_event(
    photos: list[dict],
    category_keys: list[str],
    min_score: float,
) -> list[dict]:
    """Refine per-photo categories using visual clustering + sequence smoothing.

    photos: [{id, embedding:[float], scores:{cat:float}, seq:int}]. Photos missing
            an embedding are passed through with their own argmax (no context to add).
    Returns [{id, category:str|None, source:'ai'|'cluster'}] aligned by id.
    """
    if not photos:
        return []

    # Order chronologically so bursts are contiguous — helps both the greedy
    # clustering and the sequence-smoothing pass.
    ordered = sorted(photos, key=lambda p: (p.get("seq") if p.get("seq") is not None else 0))

    def own(p: dict) -> tuple[Optional[str], float]:
        s = p.get("scores") or {}
        vals = [(k, float(s.get(k, -1.0))) for k in category_keys]
        vals = [(k, v) for k, v in vals if v > -1.0]
        if not vals:
            return None, -1.0
        best_k, best_v = max(vals, key=lambda kv: kv[1])
        return best_k, best_v

    # --- Step 1: greedy agglomerative visual clustering over embeddings ---
    clusters: list[dict] = []  # {centroid: np.ndarray, n: int, members: [idx]}
    embs: list[Optional[np.ndarray]] = []
    for p in ordered:
        e = p.get("embedding")
        if not e:
            embs.append(None)
            continue
        v = np.asarray(e, dtype=np.float32)
        n = float(np.linalg.norm(v))
        embs.append(v / n if n > 0 else None)

    member_cluster: list[Optional[int]] = [None] * len(ordered)
    for i, v in enumerate(embs):
        if v is None:
            continue
        best_ci, best_sim = -1, -1.0
        for ci, cl in enumerate(clusters):
            sim = float(np.dot(v, cl["centroid"]))
            if sim > best_sim:
                best_ci, best_sim = ci, sim
        if best_ci >= 0 and best_sim >= CLUSTER_SIM:
            cl = clusters[best_ci]
            cl["members"].append(i)
            # Running-mean centroid, renormalized.
            c = cl["centroid"] * cl["n"] + v
            cl["n"] += 1
            nrm = float(np.linalg.norm(c))
            cl["centroid"] = c / nrm if nrm > 0 else c
            member_cluster[i] = best_ci
        else:
            clusters.append({"centroid": v.copy(), "n": 1, "members": [i]})
            member_cluster[i] = len(clusters) - 1

    # --- Step 2: pooled cluster consensus (sum score vectors across members) ---
    cluster_cat: list[Optional[str]] = []
    cluster_conf: list[bool] = []
    for cl in clusters:
        pooled = {k: 0.0 for k in category_keys}
        for idx in cl["members"]:
            s = ordered[idx].get("scores") or {}
            for k in category_keys:
                pooled[k] += float(s.get(k, 0.0))
        top_k = max(pooled, key=lambda k: pooled[k])
        avg_top = pooled[top_k] / max(len(cl["members"]), 1)
        cluster_cat.append(top_k)
        cluster_conf.append(avg_top >= min_score)

    # --- Step 3: per-photo assignment ---
    assigned: list[Optional[str]] = [None] * len(ordered)
    source: list[str] = ["ai"] * len(ordered)
    for i, p in enumerate(ordered):
        own_cat, own_best = own(p)
        ci = member_cluster[i]
        c_cat = cluster_cat[ci] if ci is not None else None
        c_conf = cluster_conf[ci] if ci is not None else False
        c_size = len(clusters[ci]["members"]) if ci is not None else 0

        own_confident = own_cat is not None and own_best >= min_score

        if own_confident and (c_cat == own_cat or not c_conf or c_size < MIN_CLUSTER_OVERRIDE):
            # Trust the photo's own confident call.
            assigned[i], source[i] = own_cat, "ai"
        elif c_conf and c_cat is not None and (not own_confident or c_size >= MIN_CLUSTER_OVERRIDE):
            # Weak/ambiguous frame rescued by its burst, OR a confident-but-outvoted
            # frame corrected by a real same-scene burst (>= MIN_CLUSTER_OVERRIDE).
            assigned[i], source[i] = c_cat, ("cluster" if c_cat != own_cat else "ai")
        elif own_confident:
            assigned[i], source[i] = own_cat, "ai"
        else:
            assigned[i], source[i] = None, "ai"

    # --- Step 4: sequence smoothing — fill islands flanked by matching neighbors ---
    for i in range(len(ordered)):
        if assigned[i] is not None:
            continue
        prev_cat = assigned[i - 1] if i - 1 >= 0 else None
        next_cat = assigned[i + 1] if i + 1 < len(ordered) else None
        if prev_cat is not None and prev_cat == next_cat:
            assigned[i], source[i] = prev_cat, "cluster"

    return [
        {"id": ordered[i]["id"], "category": assigned[i], "source": source[i]}
        for i in range(len(ordered))
    ]
