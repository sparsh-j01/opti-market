import os
import threading
import time

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from typing import List, Literal, Optional
import numpy as np
import data_loader
import brain
import risk_engine

app = FastAPI(title="OptiMarket API", version="2.0.0")

# Rate limiting — per-IP. Heavy compute endpoints get tighter caps.
# Public demo: protect free Render tier from abuse without blocking real users.
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — read allowed origins from env. Defaults to local dev.
# In production, set ALLOWED_ORIGINS to a comma-separated list, e.g.
#   ALLOWED_ORIGINS="https://opti-market.vercel.app,https://www.your-domain.com"
_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
allowed_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request/Response Models ---
# Bounds protect the public free-tier demo from accidental or malicious payloads
# that would otherwise allocate gigabytes of memory or take minutes to compute.
# Pydantic returns HTTP 422 automatically when bounds are violated.

ObjectiveType = Literal["Maximize Yield", "Optimize Sharpe Ratio"]
DataSource = Literal["real", "synthetic"]
PeriodType = Literal["monthly", "quarterly"]
ALLOWED_RATINGS = {"AAA", "AA+", "AA", "AA-", "A+", "A", "A-",
                   "BBB+", "BBB", "BBB-", "BB", "B", "CCC", "D"}


class OptimizeRequest(BaseModel):
    target_duration: float = Field(5.0, ge=0.25, le=30.0)
    capital: float = Field(100_000, gt=0, le=1e9)
    max_allocation: float = Field(0.2, gt=0, le=1.0)
    objective_type: ObjectiveType = "Maximize Yield"
    risk_free_rate: float = Field(0.01, ge=0, le=0.5)
    max_junk_bond_allocation: float = Field(0.3, ge=0, le=1.0)
    max_sector_allocation: float = Field(0.25, ge=0, le=1.0)
    junk_bond_ratings: List[str] = Field(default=["BB", "B", "CCC", "D"], max_length=14)
    data_source: DataSource = "real"


class FrontierRequest(BaseModel):
    capital: float = Field(100_000, gt=0, le=1e9)
    max_allocation: float = Field(0.2, gt=0, le=1.0)
    max_junk_bond_allocation: float = Field(0.3, ge=0, le=1.0)
    max_sector_allocation: float = Field(0.25, ge=0, le=1.0)
    junk_bond_ratings: List[str] = Field(default=["BB", "B", "CCC", "D"], max_length=14)
    risk_free_rate: float = Field(0.01, ge=0, le=0.5)
    data_source: DataSource = "real"


class MonteCarloRequest(BaseModel):
    target_duration: float = Field(5.0, ge=0.25, le=30.0)
    capital: float = Field(100_000, gt=0, le=1e9)
    max_allocation: float = Field(0.2, gt=0, le=1.0)
    objective_type: ObjectiveType = "Optimize Sharpe Ratio"
    risk_free_rate: float = Field(0.01, ge=0, le=0.5)
    max_junk_bond_allocation: float = Field(0.3, ge=0, le=1.0)
    max_sector_allocation: float = Field(0.25, ge=0, le=1.0)
    junk_bond_ratings: List[str] = Field(default=["BB", "B", "CCC", "D"], max_length=14)
    n_simulations: int = Field(10_000, ge=100, le=50_000)
    time_horizon_days: int = Field(252, ge=1, le=2_520)
    data_source: DataSource = "real"


class StressTestRequest(BaseModel):
    target_duration: float = Field(5.0, ge=0.25, le=30.0)
    capital: float = Field(100_000, gt=0, le=1e9)
    max_allocation: float = Field(0.2, gt=0, le=1.0)
    objective_type: ObjectiveType = "Optimize Sharpe Ratio"
    risk_free_rate: float = Field(0.01, ge=0, le=0.5)
    max_junk_bond_allocation: float = Field(0.3, ge=0, le=1.0)
    max_sector_allocation: float = Field(0.25, ge=0, le=1.0)
    junk_bond_ratings: List[str] = Field(default=["BB", "B", "CCC", "D"], max_length=14)
    scenarios: Optional[List[str]] = Field(default=None, max_length=20)
    data_source: DataSource = "real"


class BacktestRequest(BaseModel):
    target_duration: float = Field(5.0, ge=0.25, le=30.0)
    capital: float = Field(100_000, gt=0, le=1e9)
    max_allocation: float = Field(0.2, gt=0, le=1.0)
    objective_type: ObjectiveType = "Optimize Sharpe Ratio"
    risk_free_rate: float = Field(0.01, ge=0, le=0.5)
    max_junk_bond_allocation: float = Field(0.3, ge=0, le=1.0)
    max_sector_allocation: float = Field(0.25, ge=0, le=1.0)
    junk_bond_ratings: List[str] = Field(default=["BB", "B", "CCC", "D"], max_length=14)
    n_periods: int = Field(12, ge=1, le=120)
    period_type: PeriodType = "monthly"
    data_source: DataSource = "real"

# --- Helper ---

def _get_market_df(data_source: str = "real"):
    """Gets bond market data from specified source."""
    return data_loader.generate_bond_market(data_source=data_source)


# A single Optimize click in the UI fires /optimize plus /monte-carlo,
# /stress-test and /backtest in parallel — and every one of those re-runs
# the *identical* SLSQP solve. On Render's 0.1-CPU free tier that solve is
# the dominant cost, so we memoize it: the 4 redundant solves per click
# collapse to one. Keyed by every solver-affecting parameter, short TTL so
# results stay fresh while still covering one burst of requests (#3).
_SOLVE_TTL = 90
_solve_cache: dict = {}
_solve_lock = threading.Lock()


def _solve_key(req_dict: dict) -> tuple:
    return (
        round(float(req_dict["target_duration"]), 6),
        round(float(req_dict["capital"]), 6),
        round(float(req_dict["max_allocation"]), 6),
        req_dict.get("objective_type", "Optimize Sharpe Ratio"),
        round(float(req_dict["risk_free_rate"]), 6),
        round(float(req_dict["max_junk_bond_allocation"]), 6),
        round(float(req_dict["max_sector_allocation"]), 6),
        tuple(sorted(req_dict["junk_bond_ratings"])),
        req_dict.get("data_source", "real"),
    )


def _run_optimization(req_dict: dict, market_df=None):
    """
    Shared, memoized optimization. Returns (results_df, metrics).

    The DataFrame is copied per caller so downstream consumers can mutate
    their copy without corrupting the cached result.
    """
    key = _solve_key(req_dict)
    now = time.time()

    with _solve_lock:
        hit = _solve_cache.get(key)
        if hit is not None and (now - hit["timestamp"]) < _SOLVE_TTL:
            results_df, metrics = hit["value"]
            return (results_df.copy() if results_df is not None else None), metrics

    if market_df is None:
        market_df = _get_market_df(req_dict.get("data_source", "real"))

    results_df, metrics = brain.run_solver(
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

    with _solve_lock:
        _solve_cache[key] = {"value": (results_df, metrics), "timestamp": now}
        # Bound memory: drop entries older than the TTL.
        for k in [
            k for k, v in _solve_cache.items()
            if (now - v["timestamp"]) >= _SOLVE_TTL
        ]:
            _solve_cache.pop(k, None)

    return (results_df.copy() if results_df is not None else None), metrics

# --- Endpoints ---

@app.get("/api/yield-curve")
@limiter.limit("30/minute")
def get_yield_curve(request: Request):
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
@limiter.limit("60/minute")
def get_bonds(request: Request, source: str = Query("real", description="Data source: 'real' or 'synthetic'")):
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
@limiter.limit("20/minute")
def optimize(request: Request, req: OptimizeRequest):
    """Runs the portfolio optimization solver."""
    results_df, metrics = _run_optimization(req.model_dump())

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
@limiter.limit("10/minute")
def efficient_frontier(request: Request, req: FrontierRequest):
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
@limiter.limit("10/minute")
def monte_carlo(request: Request, req: MonteCarloRequest):
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
@limiter.limit("20/minute")
def stress_test(request: Request, req: StressTestRequest):
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
        risk_free_rate=req.risk_free_rate,
    )
    
    return {"success": True, **stress_results}


@app.post("/api/backtest")
@limiter.limit("10/minute")
def backtest(request: Request, req: BacktestRequest):
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
        risk_free_rate=req.risk_free_rate,
    )
    
    return {"success": True, **bt_results}


@app.get("/api/stress-scenarios")
@limiter.limit("60/minute")
def get_stress_scenarios(request: Request):
    """Returns available stress test scenario definitions."""
    return {"scenarios": risk_engine.STRESS_SCENARIOS}


@app.get("/api/health")
@limiter.exempt
def health(request: Request):
    return {"status": "ok", "version": "2.0.0"}
