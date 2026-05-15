"""
real_data_loader.py
Loads the curated real corporate bond dataset from a static CSV.

The CSV ships with a frozen, precomputed `Volatility` column (baked once from
the old rating/duration formula). The client path is therefore RNG-free and
numpy-version independent: server and browser read identical values, so parity
is exact. No network, no FRED, no live calls — market data is a static asset.
"""

import logging
import os

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Real Bond Data Loader
# ---------------------------------------------------------------------------

_real_bonds_cache = {"data": None}


def load_real_bonds() -> pd.DataFrame:
    """
    Loads the curated real corporate bond dataset from CSV.

    Returns a DataFrame with columns matching the synthetic format:
    Bond_ID, Company, Sector, Rating, Duration, Yield, Volatility, Price

    `Volatility` is read straight from the CSV (baked once, frozen) — never
    regenerated — so the value is deterministic across numpy versions and
    identical under CPython and Pyodide.
    """
    if _real_bonds_cache["data"] is not None:
        return _real_bonds_cache["data"]

    csv_path = os.path.join(os.path.dirname(__file__), "data", "real_bonds.csv")

    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Real bond dataset not found at {csv_path}. "
            "Please ensure data/real_bonds.csv exists."
        )

    df = pd.read_csv(csv_path)

    if "Volatility" not in df.columns:
        raise ValueError(
            "real_bonds.csv is missing the baked 'Volatility' column. "
            "Re-run scripts/bake_real_bonds.py to regenerate it."
        )

    result = pd.DataFrame({
        "Bond_ID": df["CUSIP"],
        "Company": df["Issuer"],
        "Sector": df["Sector"],
        "Rating": df["Rating"],
        "Duration": df["Duration"].round(1),
        "Yield": df["Yield"].round(4) / 100.0,  # Convert from % to decimal
        "Volatility": df["Volatility"],
        "Price": df["Price"].round(2),
    })

    _real_bonds_cache["data"] = result
    return result


def get_data_source_info() -> dict:
    """
    Metadata about the real data source. Counts are derived from the actual
    loaded dataset so they can never drift from the CSV.
    """
    df = load_real_bonds()
    return {
        "source": "FINRA TRACE",
        "description": "Curated real corporate bond snapshot with actual CUSIPs, "
                       "consistent with FINRA TRACE records.",
        "bond_count": int(len(df)),
        "sectors": int(df["Sector"].nunique()),
        "rating_tiers": sorted(df["Rating"].unique().tolist()),
        "companies": sorted(df["Company"].unique().tolist()),
    }


if __name__ == "__main__":
    df = load_real_bonds()
    print(f"Loaded {len(df)} real bonds")
    print(f"Sectors: {df['Sector'].nunique()}")
    print(f"Companies: {df['Company'].nunique()}")
    print(f"Rating range: {df['Rating'].unique()}")
    print(f"\nSample:\n{df.head(10).to_string()}")
