from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import data_loader
import brain
import risk_engine

app = FastAPI(title="OptiMarket API", version="2.0.0")

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
    data_source: str = "real"

class FrontierRequest(BaseModel):
    capital: float = 100000
    max_allocation: float = 0.2
    max_junk_bond_allocation: float = 0.3
    max_sector_allocation: float = 0.25
    junk_bond_ratings: List[str] = ["BB", "B", "CCC", "D"]
    risk_free_rate: float = 0.01
    data_source: str = "real"

class MonteCarloRequest(BaseModel):
    target_duration: float = 5.0
    capital: float = 100000
    max_allocation: float = 0.2
    objective_type: str = "Optimize Sharpe Ratio"
    risk_free_rate: float = 0.01
    max_junk_bond_allocation: float = 0.3
    max_sector_allocation: float = 0.25
    junk_bond_ratings: List[str] = ["BB", "B", "CCC", "D"]
    n_simulations: int = 10000
    time_horizon_days: int = 252
    data_source: str = "real"

class StressTestRequest(BaseModel):
    target_duration: float = 5.0
    capital: float = 100000
    max_allocation: float = 0.2
    objective_type: str = "Optimize Sharpe Ratio"
    risk_free_rate: float = 0.01
    max_junk_bond_allocation: float = 0.3
    max_sector_allocation: float = 0.25
    junk_bond_ratings: List[str] = ["BB", "B", "CCC", "D"]
    scenarios: Optional[List[str]] = None
    data_source: str = "real"

class BacktestRequest(BaseModel):
    target_duration: float = 5.0
    capital: float = 100000
    max_allocation: float = 0.2
    objective_type: str = "Optimize Sharpe Ratio"
    risk_free_rate: float = 0.01
    max_junk_bond_allocation: float = 0.3
    max_sector_allocation: float = 0.25
    junk_bond_ratings: List[str] = ["BB", "B", "CCC", "D"]
    n_periods: int = 12
    period_type: str = "monthly"
    data_source: str = "real"

# --- Helper ---

def _get_market_df(data_source: str = "real"):
    """Gets bond market data from specified source."""
    return data_loader.generate_bond_market(data_source=data_source)

def _run_optimization(req_dict: dict, market_df):
    """Shared optimization logic for multiple endpoints."""
    return brain.run_solver(
        bonds_df=market_df.copy(),
        target_duration=req_dict["target_duration"],
        capital=req_dict["capital"],
        max_allocation=req_dict["max_allocation"],
        objective_type=req_dict.get("objective_type", "Optimize Sharpe Ratio"),
        risk_free_rate=req_dict["risk_free_rate"],
        max_junk_bond_allocation=req_dict["max_junk_bond_allocation"],
        max_sector_allocation=req_dict["max_sector_allocation"],
        junk_bond_ratings=req_dict["junk_bond_ratings"],
    )

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
def get_bonds(source: str = Query("real", description="Data source: 'real' or 'synthetic'")):
    """Returns bond market data from selected source."""
    market_df = _get_market_df(source)
    bonds = market_df.to_dict(orient='records')
    
    return {
        "bonds": bonds,
        "summary": {
            "total": len(market_df),
            "avg_yield": float(market_df['Yield'].mean()),
            "sectors": int(market_df['Sector'].nunique()),
            "ratings": sorted(market_df['Rating'].unique().tolist())
        },
        "data_source": source,
    }

@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    """Runs the portfolio optimization solver."""
    market_df = _get_market_df(req.data_source)
    
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
            },
            "data_source": req.data_source,
        }
    else:
        return {
            "success": False,
            "error": str(metrics)
        }

@app.post("/api/efficient-frontier")
def efficient_frontier(req: FrontierRequest):
    """Generates the efficient frontier by sweeping duration targets."""
    market_df = _get_market_df(req.data_source)
    
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


@app.post("/api/monte-carlo")
def monte_carlo(req: MonteCarloRequest):
    """
    Runs Monte Carlo simulation on the optimized portfolio.
    Returns VaR, CVaR, and P&L distribution histogram.
    """
    market_df = _get_market_df(req.data_source)
    
    results_df, metrics = _run_optimization(req.model_dump(), market_df)
    
    if results_df is None:
        return {"success": False, "error": str(metrics)}
    
    weights = results_df['Allocation %'].values / 100.0
    weights = weights / weights.sum()  # Normalize
    
    cov_matrix = data_loader.generate_covariance_matrix(results_df)
    
    mc_results = risk_engine.run_monte_carlo(
        weights=weights,
        expected_returns=results_df['Yield'].values,
        cov_matrix=cov_matrix,
        capital=req.capital,
        n_simulations=req.n_simulations,
        time_horizon_days=req.time_horizon_days,
    )
    
    return {"success": True, **mc_results}


@app.post("/api/stress-test")
def stress_test(req: StressTestRequest):
    """
    Runs stress test scenarios on the optimized portfolio.
    Returns P&L impact under each scenario.
    """
    market_df = _get_market_df(req.data_source)
    
    results_df, metrics = _run_optimization(req.model_dump(), market_df)
    
    if results_df is None:
        return {"success": False, "error": str(metrics)}
    
    weights = results_df['Allocation %'].values / 100.0
    weights = weights / weights.sum()
    
    stress_results = risk_engine.run_stress_test(
        portfolio_df=results_df,
        weights=weights,
        capital=req.capital,
        scenarios=req.scenarios,
    )
    
    return {"success": True, **stress_results}


@app.post("/api/backtest")
def backtest(req: BacktestRequest):
    """
    Runs backtesting simulation comparing optimized portfolio
    against equal-weight and risk-free benchmarks.
    """
    market_df = _get_market_df(req.data_source)
    
    results_df, metrics = _run_optimization(req.model_dump(), market_df)
    
    if results_df is None:
        return {"success": False, "error": str(metrics)}
    
    weights = results_df['Allocation %'].values / 100.0
    weights = weights / weights.sum()
    
    bt_results = risk_engine.run_backtest(
        portfolio_df=results_df,
        weights=weights,
        capital=req.capital,
        n_periods=req.n_periods,
        period_type=req.period_type,
    )
    
    return {"success": True, **bt_results}


@app.get("/api/stress-scenarios")
def get_stress_scenarios():
    """Returns available stress test scenario definitions."""
    return {"scenarios": risk_engine.STRESS_SCENARIOS}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
