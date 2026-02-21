import yfinance as yf
import pandas as pd
import numpy as np
import random
from scipy.optimize import curve_fit
from functools import lru_cache
import time

def nelson_siegel(t, beta0, beta1, beta2, lambda_):
    """Nelson-Siegel formula for realistic yield curves."""
    t = np.maximum(t, 1e-5)
    term1 = (1 - np.exp(-lambda_ * t)) / (lambda_ * t)
    term2 = term1 - np.exp(-lambda_ * t)
    return beta0 + beta1 * term1 + beta2 * term2

# Simple time-based cache (15 min TTL)
_treasury_cache = {"data": None, "timestamp": 0}

def fetch_real_treasury_rates():
    """
    Fetches LIVE Treasury yields and fits the Nelson-Siegel parametric curve.
    Cached for 15 minutes.
    """
    global _treasury_cache
    now = time.time()
    if _treasury_cache["data"] is not None and (now - _treasury_cache["timestamp"]) < 900:
        return _treasury_cache["data"]
    
    tickers = ["^IRX", "^FVX", "^TNX", "^TYX"]

    try:
        data = yf.download(tickers, period="1d")['Close'].iloc[-1]
        
        maturities = np.array([0.25, 5.0, 10.0, 30.0])
        rates = np.array([
            float(data.get('^IRX', 4.0)) / 100.0,
            float(data.get('^FVX', 4.0)) / 100.0,
            float(data.get('^TNX', 4.2)) / 100.0,
            float(data.get('^TYX', 4.5)) / 100.0
        ])
        
        guess = [0.05, -0.01, 0.01, 0.5]
        bounds = ([0.0, -0.2, -0.2, 0.01], [0.2, 0.2, 0.2, 5.0])
        
        opt_params, _ = curve_fit(nelson_siegel, maturities, rates, p0=guess, bounds=bounds)
        
        result = {
            "maturities": maturities.tolist(),
            "rates": rates.tolist(),
            "ns_params": opt_params.tolist()
        }
    except Exception as e:
        print(f"Using fallback rates due to yfinance error: {e}")
        result = {
            "maturities": [0.25, 5.0, 10.0, 30.0],
            "rates": [0.04, 0.042, 0.045, 0.048],
            "ns_params": [0.05, -0.01, 0.01, 0.5]
        }
    
    _treasury_cache["data"] = result
    _treasury_cache["timestamp"] = now
    return result

# Simple time-based cache for bond market (1 hour TTL)
_bond_market_cache = {"data": None, "timestamp": 0}

def generate_bond_market(n_bonds=150):
    """
    Generates a synthetic bond market using Nelson-Siegel curve for base yields.
    Uses a fixed seed for reproducibility (important for research paper).
    """
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
        if volatility < 0.01: volatility = 0.01

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
    
    C = np.full((n, n), 0.25)
    np.fill_diagonal(C, 1.0)
    
    ig_ratings = ["AAA", "AA", "A", "BBB"]
    
    for i in range(n):
        for j in range(i+1, n):
            if sectors[i] == sectors[j]:
                C[i, j] += 0.3
                C[j, i] += 0.3
            
            is_i_ig = ratings[i] in ig_ratings
            is_j_ig = ratings[j] in ig_ratings
            if is_i_ig == is_j_ig:
                C[i, j] += 0.15
                C[j, i] += 0.15
                
            C[i, j] = min(C[i, j], 0.90)
            C[j, i] = min(C[j, i], 0.90)
            
    diag_vols = np.diag(vols)
    cov_matrix = diag_vols @ C @ diag_vols
    cov_matrix += np.eye(n) * 1e-8
    
    return cov_matrix

if __name__ == "__main__":
    generate_bond_market()