"""
scripts/bake_real_bonds.py — freeze the Volatility column into real_bonds.csv.

D2: the old loader computed Volatility with np.random.default_rng(42). Different
numpy versions can produce a different RNG stream in WASM → different numbers in
the browser than on the server. This script computes that column ONCE with the
historical formula and writes it back into the CSV as a frozen column, so the
runtime path (server oracle + browser worker) just reads it. RNG-free, exact
parity, numpy-version independent.

Idempotent: drops any existing Volatility column and recomputes from the raw
rating/duration inputs, so the frozen values never drift.

Usage:  python scripts/bake_real_bonds.py
"""

import os
import sys

import numpy as np
import pandas as pd

CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "real_bonds.csv",
)

_RATING_VOL_MAP = {
    "AAA": 0.04, "AA+": 0.05, "AA": 0.055, "AA-": 0.06,
    "A+": 0.07, "A": 0.08, "A-": 0.09,
    "BBB+": 0.10, "BBB": 0.11, "BBB-": 0.13,
    "BB": 0.16, "B": 0.22, "CCC": 0.28,
}


def compute_volatility(df: pd.DataFrame) -> pd.Series:
    """The exact historical formula, seeded so the bake is reproducible."""
    rng = np.random.default_rng(42)
    return df.apply(
        lambda row: round(
            _RATING_VOL_MAP.get(row["Rating"], 0.10)
            + (row["Duration"] / 30.0) * 0.03
            + float(rng.uniform(-0.005, 0.005)),
            4,
        ),
        axis=1,
    )


def main() -> int:
    df = pd.read_csv(CSV_PATH)
    df = df.drop(columns=["Volatility"], errors="ignore")
    df["Volatility"] = compute_volatility(df)
    df.to_csv(CSV_PATH, index=False)
    print(f"Baked Volatility into {CSV_PATH} ({len(df)} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
