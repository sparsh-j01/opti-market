import yfinance as yf
import pandas as pd
import numpy as np
import random
import streamlit as st

@st.cache_data(ttl=900) # Cache for 15 minutes
def fetch_real_treasury_rates():
    """
    Fetches LIVE Treasury yields from Yahoo Finance to anchor our model.
    """
    tickers = ["^FVX", "^TNX", "^TYX"]

    data = yf.download(tickers, period="1d")['Close'].iloc[-1]
    
    r_5 = data['^FVX'] / 100
    r_10 = data['^TNX'] / 100
    r_30 = data['^TYX'] / 100
    
    return {5: r_5, 10: r_10, 30: r_30}

@st.cache_data(ttl=3600) # Cache for 1 hour
def generate_bond_market(n_bonds=150):
    """
    Generates a synthetic bond market, anchored to real treasury rates.
    """
    try:
        real_rates = fetch_real_treasury_rates()
        base_rate = real_rates[10] # Use 10Y as baseline

    except Exception as e:

        base_rate = 0.045 # Fallback if no internet
    
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
    
    # Reverse map for easier lookup
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
        duration_premium = (duration / 30) * 0.01
        yield_val = base_rate + spread + duration_premium + random.uniform(-0.005, 0.005)
        price = 100 / ((1 + yield_val) ** duration)
        
        # Calculate Volatility - higher for lower ratings and longer durations
        base_vol = ratings_info[rating]["base_vol"]
        volatility = round(base_vol + (duration / 15.0) * 0.05 + random.uniform(-0.01, 0.01), 4)
        if volatility < 0.01: volatility = 0.01 # Ensure non-negative volatility

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
    return df

if __name__ == "__main__":
    generate_bond_market()