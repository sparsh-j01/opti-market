"""
scripts/gen_parity_golden.py — produce the keystone parity golden.

Runs core_api under CPython on a fixed set of default params and writes the
resulting metrics to frontend/e2e/parity_golden.json. The Playwright keystone
test runs the SAME params through the in-browser Pyodide path and asserts the
numbers match within 1e-6 — proving browser == server-oracle.

Usage:  python scripts/gen_parity_golden.py
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import core_api  # noqa: E402

# Reset the solve cache so the golden reflects a cold compute, like a fresh
# browser tab does.
core_api._solve_cache.clear()

CASES = {
    "optimize_default": {
        "fn": "optimize",
        "params": {"target_duration": 5.0, "data_source": "real"},
    },
    "optimize_sharpe": {
        "fn": "optimize",
        "params": {
            "target_duration": 5.0,
            "objective_type": "Optimize Sharpe Ratio",
            "data_source": "real",
        },
    },
}

OUT = os.path.join(ROOT, "frontend", "e2e", "parity_golden.json")


def main() -> int:
    golden = {}
    for name, case in CASES.items():
        result = getattr(core_api, case["fn"])(case["params"])
        assert result["success"], f"{name} did not succeed: {result.get('error')}"
        golden[name] = {
            "params": case["params"],
            "fn": case["fn"],
            "metrics": result["metrics"],
        }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(golden, f, indent=2, sort_keys=True)
    print(f"Wrote {OUT} ({len(golden)} cases)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
