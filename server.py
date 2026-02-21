from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import data_loader
import brain

app = FastAPI(title="OptiMarket API", version="1.0.0")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request/Response Models ---

class OptimizeRequest(BaseModel):
    target_duration: float = 5.0
    capital: float = 100000
    max_allocation: float = 0.2
    objective_type: str = "Maximize Yield"
    risk_free_rate: float = 0.01
    max_junk_bond_allocation: float = 0.3
    max_sector_allocation: float = 0.25
    junk_bond_ratings: List[str] = ["BB", "B", "CCC", "D"]

class FrontierRequest(BaseModel):
    capital: float = 100000
    max_allocation: float = 0.2
    max_junk_bond_allocation: float = 0.3
    max_sector_allocation: float = 0.25
    junk_bond_ratings: List[str] = ["BB", "B", "CCC", "D"]
    risk_free_rate: float = 0.01

# --- Endpoints ---

@app.get("/api/yield-curve")
def get_yield_curve():
    """Returns Nelson-Siegel parameters and the fitted yield curve data."""
    rates_data = data_loader.fetch_real_treasury_rates()
    beta0, beta1, beta2, lambda_ = rates_data["ns_params"]
    
    # Generate smooth curve points
    maturities_plot = np.linspace(0.25, 30.0, 100).tolist()
    curve_yields = [float(data_loader.nelson_siegel(t, beta0, beta1, beta2, lambda_)) for t in maturities_plot]
    
    return {
        "ns_params": {
            "beta0": beta0,
            "beta1": beta1,
            "beta2": beta2,
            "lambda": lambda_
        },
        "data_points": {
            "maturities": rates_data["maturities"],
            "rates": rates_data["rates"]
        },
        "curve": {
            "maturities": maturities_plot,
            "yields": curve_yields
        }
    }

@app.get("/api/bonds")
def get_bonds():
    """Returns the synthetic bond market data."""
    market_df = data_loader.generate_bond_market()
    bonds = market_df.to_dict(orient='records')
    
    return {
        "bonds": bonds,
        "summary": {
            "total": len(market_df),
            "avg_yield": float(market_df['Yield'].mean()),
            "sectors": int(market_df['Sector'].nunique()),
            "ratings": sorted(market_df['Rating'].unique().tolist())
        }
    }

@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    """Runs the portfolio optimization solver."""
    market_df = data_loader.generate_bond_market()
    
    results_df, metrics = brain.run_solver(
        bonds_df=market_df.copy(),
        target_duration=req.target_duration,
        capital=req.capital,
        max_allocation=req.max_allocation,
        objective_type=req.objective_type,
        risk_free_rate=req.risk_free_rate,
        max_junk_bond_allocation=req.max_junk_bond_allocation,
        max_sector_allocation=req.max_sector_allocation,
        junk_bond_ratings=req.junk_bond_ratings
    )
    
    if results_df is not None:
        portfolio = results_df[['Bond_ID', 'Company', 'Sector', 'Rating', 'Yield', 'Duration', 'Volatility', 'Allocation %', 'Investment ($)']].to_dict(orient='records')
        
        # Compute allocation breakdowns
        rating_alloc = results_df.groupby('Rating')['Allocation %'].sum().reset_index().to_dict(orient='records')
        sector_alloc = results_df.groupby('Sector')['Allocation %'].sum().reset_index().to_dict(orient='records')
        company_alloc = results_df.groupby('Company')['Allocation %'].sum().reset_index().to_dict(orient='records')
        
        return {
            "success": True,
            "portfolio": portfolio,
            "metrics": metrics,
            "allocations": {
                "by_rating": rating_alloc,
                "by_sector": sector_alloc,
                "by_company": company_alloc
            }
        }
    else:
        return {
            "success": False,
            "error": str(metrics)
        }

@app.post("/api/efficient-frontier")
def efficient_frontier(req: FrontierRequest):
    """Generates the efficient frontier by sweeping duration targets."""
    market_df = data_loader.generate_bond_market()
    
    frontier = brain.generate_efficient_frontier(
        market_df.copy(),
        capital=req.capital,
        max_alloc=req.max_allocation,
        max_junk=req.max_junk_bond_allocation,
        max_sector=req.max_sector_allocation,
        junk_ratings=req.junk_bond_ratings,
        risk_free_rate=req.risk_free_rate
    )
    
    return {"frontier": frontier}

@app.get("/api/health")
def health():
    return {"status": "ok"}
