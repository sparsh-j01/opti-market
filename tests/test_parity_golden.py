"""
Keeps the Playwright keystone golden honest: parity_golden.json must reflect
the CURRENT core_api output, so a browser-vs-oracle 1e-6 comparison is
meaningful. If core_api changes the numbers, regenerate the golden.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import core_api  # noqa: E402

GOLDEN = os.path.join(ROOT, "frontend", "e2e", "parity_golden.json")


def test_parity_golden_is_current():
    with open(GOLDEN) as f:
        golden = json.load(f)

    core_api._solve_cache.clear()
    for name, case in golden.items():
        result = getattr(core_api, case["fn"])(case["params"])
        assert result["success"], name
        for k, expected in case["metrics"].items():
            assert abs(result["metrics"][k] - expected) < 1e-9, (
                f"{name}.{k} drifted; run scripts/gen_parity_golden.py"
            )
