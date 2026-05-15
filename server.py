"""
server.py — thin FastAPI wrappers over core_api.

This is NOT hosted and no user ever hits it. It exists only as the
testing / CI parity oracle: the answer-key the browser (Pyodide) path is
checked against. All real compute lives in core_api.py, which the browser
worker imports verbatim, so server == browser by construction.

Run locally / in CI only:  uvicorn server:app
"""

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field
from typing import List, Literal, Optional

import core_api

app = FastAPI(title="OptiMarket API (parity oracle)", version="3.0.0")

# --- Request models ---
# Kept so the oracle validates exactly as the old hosted API did; the bounds
# also document the parameter ranges the browser worker should respect.

ObjectiveType = Literal["Maximize Yield", "Optimize Sharpe Ratio"]
DataSource = Literal["real", "synthetic"]
PeriodType = Literal["monthly", "quarterly"]


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


# --- Endpoints: thin delegation to core_api ---

@app.get("/api/yield-curve")
def get_yield_curve():
    return core_api.yield_curve()


@app.get("/api/bonds")
def get_bonds(source: str = Query("real", description="Data source: 'real' or 'synthetic'")):
    return core_api.bonds(source)


@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    return core_api.optimize(req.model_dump())


@app.post("/api/efficient-frontier")
def efficient_frontier(req: FrontierRequest):
    return core_api.efficient_frontier(req.model_dump())


@app.post("/api/monte-carlo")
def monte_carlo(req: MonteCarloRequest):
    return core_api.monte_carlo(req.model_dump())


@app.post("/api/stress-test")
def stress_test(req: StressTestRequest):
    return core_api.stress_test(req.model_dump())


@app.post("/api/backtest")
def backtest(req: BacktestRequest):
    return core_api.backtest(req.model_dump())


@app.get("/api/stress-scenarios")
def get_stress_scenarios():
    return core_api.stress_scenarios()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "3.0.0"}
