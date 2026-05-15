import json
import logging
import os
import random
import time

import numpy as np
import pandas as pd

import real_data_loader

logger = logging.getLogger(__name__)


def nelson_siegel(t, beta0, beta1, beta2, lambda_):
    """Nelson-Siegel formula for realistic yield curves."""
    t = np.maximum(t, 1e-5)
    term1 = (1 - np.exp(-lambda_ * t)) / (lambda_ * t)
    term2 = term1 - np.exp(-lambda_ * t)
    return beta0 + beta1 * term1 + beta2 * term2


# --- Treasury yield curve: static, build-time snapshot ---
#
# The curve is refreshed at PUBLISH time by scripts/refresh_treasury.py (run
# in a GitHub Action), which commits a fresh treasury_snapshot.json. At runtime
# — server oracle or browser worker — we only ever read that static file. No
# yfinance, no network, no threads: the browser can't call Yahoo (CORS) and
# doesn't need to. Falls back to constants if the snapshot is missing.

_SNAPSHOT_PATH = os.path.join(os.path.dirname(__file__), "data", "treasury_snapshot.json")

_FALLBACK_TREASURY = {
    "maturities": [0.25, 5.0, 10.0, 30.0],
    "rates": [0.04, 0.042, 0.045, 0.048],
    "ns_params": [0.05, -0.01, 0.01, 0.5],
}


def _load_treasury_snapshot():
    """Reads the build-time snapshot from disk; falls back to constants."""
    try:
        with open(_SNAPSHOT_PATH) as f:
            snap = json.load(f)
        return {k: snap[k] for k in ("maturities", "rates", "ns_params")}
    except Exception:
        return dict(_FALLBACK_TREASURY)


_treasury_data = _load_treasury_snapshot()


def fetch_real_treasury_rates():
    """
    Returns Treasury yields and fitted Nelson-Siegel parameters from the
    build-time static snapshot. Never touches the network.
    """
    return _treasury_data


# Simple time-based cache for synthetic bond market (1 hour TTL)
_bond_market_cache = {"data": None, "timestamp": 0}


def generate_bond_market(n_bonds=150, data_source="synthetic"):
    """
    Returns bond market data from the specified source.

    Parameters:
        n_bonds: Number of bonds for synthetic mode
        data_source: 'real' or 'synthetic'
    """
    if data_source == "real":
        return real_data_loader.load_real_bonds()

    global _bond_market_cache
    now = time.time()
    if _bond_market_cache["data"] is not None and (now - _bond_market_cache["timestamp"]) < 3600:
        return _bond_market_cache["data"]

    # Fixed seed for reproducibility
    random.seed(42)
    np.random.seed(42)

    rates_data = fetch_real_treasury_rates()
    beta0, beta1, beta2, lambda_ = rates_data["ns_params"]

    bond_data = []
    companies = ["Apple", "Microsoft", "Tesla", "JPMorgan", "Amazon", "Google", "Goldman", "Coca-Cola", "Pfizer", "Verizon", "Exxon Mobil", "Chevron", "Walmart", "Procter & Gamble", "Johnson & Johnson", "Bank of America", "AT&T", "Ford", "General Electric", "Boeing", "Caterpillar", "Disney", "Intel", "IBM", "Oracle", "Cisco", "PepsiCo", "McDonald's", "Nike", "Home Depot", "Costco", "Salesforce", "Honeywell", "Union Pacific", "UPS", "Lowe's", "American Express", "Medtronic", "Abbott Labs", "Bristol Myers Squibb"]
    sectors = {"Technology": ["Apple", "Microsoft", "Google", "Intel", "IBM", "Oracle", "Cisco", "Salesforce"],
               "Financials": ["JPMorgan", "Goldman", "Bank of America", "American Express"],
               "Consumer Discretionary": ["Tesla", "Amazon", "Disney", "Ford", "McDonald's", "Nike", "Home Depot", "Lowe's"],
               "Consumer Staples": ["Coca-Cola", "Walmart", "Procter & Gamble", "Johnson & Johnson", "PepsiCo", "Costco"],
               "Healthcare": ["Pfizer", "Medtronic", "Abbott Labs", "Bristol Myers Squibb"],
               "Telecommunication": ["Verizon", "AT&T"],
               "Energy": ["Exxon Mobil", "Chevron"],
               "Industrials": ["General Electric", "Boeing", "Caterpillar", "Honeywell", "Union Pacific", "UPS"]
              }

    company_to_sector = {comp: sector for sector, comps in sectors.items() for comp in comps}

    ratings_info = {
        "AAA": {"spread": 0.005, "base_vol": 0.05},
        "AA": {"spread": 0.008, "base_vol": 0.06},
        "A": {"spread": 0.012, "base_vol": 0.08},
        "BBB": {"spread": 0.020, "base_vol": 0.10},
        "BB": {"spread": 0.040, "base_vol": 0.15},
        "B": {"spread": 0.060, "base_vol": 0.20},
        "CCC": {"spread": 0.090, "base_vol": 0.25},
        "D": {"spread": 0.120, "base_vol": 0.30},
    }

    for i in range(n_bonds):
        company = random.choice(companies)
        sector = company_to_sector[company]
        rating = random.choice(list(ratings_info.keys()))
        duration = round(random.uniform(1.0, 15.0), 1)

        spread = ratings_info[rating]["spread"]
        base_yield_at_duration = nelson_siegel(duration, beta0, beta1, beta2, lambda_)

        yield_val = base_yield_at_duration + spread + random.uniform(-0.005, 0.005)
        price = 100 / ((1 + yield_val) ** duration)

        base_vol = ratings_info[rating]["base_vol"]
        volatility = round(base_vol + (duration / 15.0) * 0.05 + random.uniform(-0.01, 0.01), 4)
        if volatility < 0.01:
            volatility = 0.01

        bond_data.append({
            "Bond_ID": f"{company[:3].upper()}-{random.randint(1000,9999)}",
            "Company": company,
            "Sector": sector,
            "Rating": rating,
            "Duration": duration,
            "Yield": round(yield_val, 4),
            "Volatility": volatility,
            "Price": round(price * 100, 2)
        })

    df = pd.DataFrame(bond_data)
    _bond_market_cache["data"] = df
    _bond_market_cache["timestamp"] = now
    return df


def generate_covariance_matrix(bonds_df):
    """
    Constructs a covariance matrix with correlations based on
    sector and credit tier similarity.
    """
    n = len(bonds_df)
    vols = bonds_df['Volatility'].values
    sectors = bonds_df['Sector'].values
    ratings = bonds_df['Rating'].values

    # Vectorized correlation build: 0.25 base, +0.3 same-sector,
    # +0.15 same-IG-status, off-diagonals clamped at 0.90, unit diagonal.
    ig_ratings = {"AAA", "AA", "A", "BBB"}
    same_sector = sectors[:, None] == sectors[None, :]
    is_ig = np.array([r in ig_ratings for r in ratings])
    same_ig = is_ig[:, None] == is_ig[None, :]

    C = np.full((n, n), 0.25)
    C += np.where(same_sector, 0.30, 0.0)
    C += np.where(same_ig, 0.15, 0.0)
    np.clip(C, None, 0.90, out=C)
    np.fill_diagonal(C, 1.0)

    diag_vols = np.diag(vols)
    cov_matrix = diag_vols @ C @ diag_vols
    cov_matrix += np.eye(n) * 1e-8

    return cov_matrix


if __name__ == "__main__":
    import sys
    source = sys.argv[1] if len(sys.argv) > 1 else "synthetic"
    df = generate_bond_market(data_source=source)
    print(f"Loaded {len(df)} bonds ({source} mode)")
    print(df.head(10).to_string())
