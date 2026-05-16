"""
scripts/reprice_bonds_today.py — re-anchor the real bond universe to today.

There is no free per-CUSIP corporate-bond feed, so the curated universe
(CUSIPs, issuers, sectors, ratings, durations, coupons, maturities) is kept
exactly as-is. What gets refreshed is the time-varying part:

    Yield = today's Treasury curve at the bond's maturity   (live, from
            data/treasury_snapshot.json — refreshed by refresh_treasury.py)
          + a standard credit spread for the bond's rating

Price is then recomputed from Coupon/Yield/Maturity so it stays internally
consistent (a fixed-coupon present-value formula). Rating and Duration are
untouched, so the frozen Volatility column (baked from Rating+Duration) stays
valid and bake_real_bonds.py remains idempotent.

Re-run any day after refresh_treasury.py to get yields "as of today".

Usage:  python scripts/refresh_treasury.py        # fetch today's curve
        python scripts/reprice_bonds_today.py     # re-anchor the bonds
"""

import json
import os
import sys

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from data_loader import nelson_siegel  # noqa: E402

CSV_PATH = os.path.join(ROOT, "data", "real_bonds.csv")
SNAPSHOT_PATH = os.path.join(ROOT, "data", "treasury_snapshot.json")

# Investment-grade credit spreads over Treasuries, in percent. Notched,
# monotonic by quality. Representative current-market levels for an
# educational tool, not a live OAS feed.
_RATING_SPREAD_PCT = {
    "AAA": 0.45,
    "AA+": 0.55, "AA": 0.65, "AA-": 0.75,
    "A+": 0.90, "A": 1.05, "A-": 1.25,
    "BBB+": 1.50, "BBB": 1.80, "BBB-": 2.20,
    # high yield, in case the universe ever adds it
    "BB": 3.25, "B": 4.75, "CCC": 7.50, "D": 12.0,
}


def _spread_pct(rating: str) -> float:
    if rating in _RATING_SPREAD_PCT:
        return _RATING_SPREAD_PCT[rating]
    base = rating.rstrip("+-")  # AA+ -> AA fallback
    return _RATING_SPREAD_PCT.get(base, 1.50)


def _bond_price(coupon: float, ytm_pct: float, years: float) -> float:
    """Present value of a fixed annual-coupon bond, face 100. Handles
    fractional maturities via the closed-form annuity expression."""
    y = ytm_pct / 100.0
    n = max(years, 1e-6)
    if abs(y) < 1e-9:
        return round(coupon * n + 100.0, 2)
    annuity = (1 - (1 + y) ** -n) / y
    price = coupon * annuity + 100.0 * (1 + y) ** -n
    return round(float(price), 2)


def main() -> int:
    with open(SNAPSHOT_PATH) as fh:
        snap = json.load(fh)
    b0, b1, b2, lam = snap["ns_params"]

    df = pd.read_csv(CSV_PATH)

    base = nelson_siegel(df["Maturity_Years"].to_numpy(float), b0, b1, b2, lam)
    base_pct = np.asarray(base, dtype=float) * 100.0
    spread_pct = df["Rating"].map(_spread_pct).to_numpy(float)

    df["Yield"] = np.round(base_pct + spread_pct, 2)
    df["Price"] = [
        _bond_price(c, y, m)
        for c, y, m in zip(df["Coupon"], df["Yield"], df["Maturity_Years"])
    ]

    # Volatility is re-derived downstream by bake_real_bonds.py from the
    # untouched Rating/Duration; drop it here so the bake stays the only writer.
    df = df.drop(columns=["Volatility"], errors="ignore")
    df.to_csv(CSV_PATH, index=False)

    lo, hi, mean = df["Yield"].min(), df["Yield"].max(), df["Yield"].mean()
    print(f"Repriced {len(df)} bonds off today's curve "
          f"(NS level {b0:.4f}). Yield %: min {lo:.2f} / mean {mean:.2f} / max {hi:.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
