"""
scripts/refresh_treasury.py — build-time treasury curve refresh.

Runs at PUBLISH time only (locally or in a GitHub Action), never at runtime.
Fetches the live Treasury curve via yfinance, fits Nelson-Siegel, and writes
data/treasury_snapshot.json. Committing that file triggers a Vercel redeploy,
so visitors always get a curve that was current at the last deploy — at $0,
deterministically, with zero runtime network calls.

Usage:  python scripts/refresh_treasury.py
"""

import json
import os
import sys

import numpy as np
from scipy.optimize import curve_fit

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data_loader import nelson_siegel  # noqa: E402

SNAPSHOT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "treasury_snapshot.json",
)


def fit_treasury_from_yf() -> dict:
    """Live yfinance fetch + Nelson-Siegel fit. Build-time only."""
    import time

    import yfinance as yf

    tickers = ["^IRX", "^FVX", "^TNX", "^TYX"]
    data = yf.download(tickers, period="1d")["Close"].iloc[-1]

    maturities = np.array([0.25, 5.0, 10.0, 30.0])
    rates = np.array([
        float(data.get("^IRX", 4.0)) / 100.0,
        float(data.get("^FVX", 4.0)) / 100.0,
        float(data.get("^TNX", 4.2)) / 100.0,
        float(data.get("^TYX", 4.5)) / 100.0,
    ])

    guess = [0.05, -0.01, 0.01, 0.5]
    bounds = ([0.0, -0.2, -0.2, 0.01], [0.2, 0.2, 0.2, 5.0])
    opt_params, _ = curve_fit(nelson_siegel, maturities, rates, p0=guess, bounds=bounds)

    return {
        "maturities": maturities.tolist(),
        "rates": rates.tolist(),
        "ns_params": opt_params.tolist(),
        "timestamp": time.time(),
    }


def main() -> int:
    try:
        snapshot = fit_treasury_from_yf()
    except Exception as e:  # noqa: BLE001
        print(f"Treasury refresh failed: {e}", file=sys.stderr)
        return 1

    tmp_path = f"{SNAPSHOT_PATH}.tmp"
    with open(tmp_path, "w") as f:
        json.dump(snapshot, f, indent=2)
    os.replace(tmp_path, SNAPSHOT_PATH)

    print(f"Wrote {SNAPSHOT_PATH}")
    print(f"  rates:     {snapshot['rates']}")
    print(f"  ns_params: {snapshot['ns_params']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
