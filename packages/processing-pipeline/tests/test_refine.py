"""Unit tests for the holistic burst + visual-clustering refine.

Torch-free — imports only app/refine.py (numpy). Run:
    python3 packages/processing-pipeline/tests/test_refine.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

import numpy as np  # noqa: E402
from refine import refine_event  # noqa: E402

KEYS = ["couple", "ceremony", "dances", "reception", "main_course", "family", "venue"]
MIN = 0.20


def _emb(base, jitter=0.0, seed=0):
    rng = np.random.RandomState(seed)
    v = np.array(base, dtype=np.float32) + rng.randn(len(base)).astype(np.float32) * jitter
    return (v / np.linalg.norm(v)).tolist()


def test_ambiguous_frame_rescued_by_burst():
    """A weak 'shoe' frame inside a couple burst inherits 'couple' from its cluster."""
    A = [1, 0, 0, 0, 0, 0, 0, 0]
    photos = []
    for i in range(5):
        if i == 2:  # ambiguous frame: everything below the floor
            scores = {k: 0.10 for k in KEYS}
            scores["reception"] = 0.19
        else:
            scores = {k: 0.10 for k in KEYS}
            scores["couple"] = 0.30
        photos.append({"id": f"a{i}", "embedding": _emb(A, 0.02, i), "scores": scores, "seq": i})
    out = {o["id"]: o for o in refine_event(photos, KEYS, MIN)}
    assert out["a2"]["category"] == "couple", out["a2"]
    assert out["a2"]["source"] == "cluster", out["a2"]
    assert out["a0"]["category"] == "couple" and out["a0"]["source"] == "ai"


def test_distinct_confident_shot_preserved():
    """A lone confident family portrait in its own visual cluster is never overridden."""
    B = [0, 0, 0, 0, 0, 0, 0, 1]
    scores = {k: 0.10 for k in KEYS}
    scores["family"] = 0.31
    photos = [{"id": "b0", "embedding": _emb(B, 0.0, 99), "scores": scores, "seq": 10}]
    out = refine_event(photos, KEYS, MIN)
    assert out[0]["category"] == "family" and out[0]["source"] == "ai", out


def test_burst_overrides_outvoted_confident_frame():
    """One frame misclassified 'ceremony' inside a large confident couple burst is corrected."""
    A = [1, 0, 0, 0, 0, 0, 0, 0]
    photos = []
    for i in range(4):
        scores = {k: 0.10 for k in KEYS}
        scores["couple"] = 0.30
        photos.append({"id": f"c{i}", "embedding": _emb(A, 0.02, i), "scores": scores, "seq": i})
    # A 5th same-scene frame the model wrongly called ceremony with confidence.
    wrong = {k: 0.10 for k in KEYS}
    wrong["ceremony"] = 0.28
    photos.append({"id": "cX", "embedding": _emb(A, 0.02, 5), "scores": wrong, "seq": 4})
    out = {o["id"]: o for o in refine_event(photos, KEYS, MIN)}
    assert out["cX"]["category"] == "couple", out["cX"]
    assert out["cX"]["source"] == "cluster", out["cX"]


def test_sequence_smoothing_fills_island():
    """A null frame between two matching neighbors (no shared cluster) is filled."""
    # Three visually-distinct frames but temporally adjacent; middle is ambiguous.
    left = {k: 0.10 for k in KEYS}
    left["dances"] = 0.30
    mid = {k: 0.05 for k in KEYS}  # all below floor -> null on its own
    right = {k: 0.10 for k in KEYS}
    right["dances"] = 0.30
    photos = [
        {"id": "L", "embedding": _emb([1, 0, 0, 0], 0.0, 1), "scores": left, "seq": 0},
        {"id": "M", "embedding": _emb([0, 1, 0, 0], 0.0, 2), "scores": mid, "seq": 1},
        {"id": "R", "embedding": _emb([0, 0, 1, 0], 0.0, 3), "scores": right, "seq": 2},
    ]
    out = {o["id"]: o for o in refine_event(photos, KEYS, MIN)}
    assert out["M"]["category"] == "dances" and out["M"]["source"] == "cluster", out["M"]


def test_category_agnostic_four_categories():
    """Works with an arbitrary (e.g. 4-category) key set, not just the built-in 7."""
    four = ["ceremony", "couple", "family", "venue"]
    scores = {k: 0.10 for k in four}
    scores["venue"] = 0.35
    photos = [{"id": "v", "embedding": _emb([1, 1, 0, 0], 0.0, 7), "scores": scores, "seq": 0}]
    out = refine_event(photos, four, MIN)
    assert out[0]["category"] == "venue", out


def test_empty_input():
    assert refine_event([], KEYS, MIN) == []


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} refine tests passed.")
