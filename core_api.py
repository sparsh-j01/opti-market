"""
core_api.py — single source of truth for OptiMarket's compute.

Every function here takes a plain params dict and returns exactly the JSON
dict the corresponding endpoint returns. Both the FastAPI server (the CI /
testing parity oracle) and the in-browser Pyodide worker import this module,
so the server and the browser run *identical* code → parity is near-automatic.

No web framework imports. No request/response objects. Pure functions over
dicts so the same code runs under CPython and under Pyodide (WASM).
"""

import threading
import time

import numpy as np

import brain
import data_loader
import risk_engine

# --- Parameter defaults ---
# These mirror the Field(...) defaults in the server's Pydantic models. The
# server still validates/﻿coerces via Pydantic; the worker has no Pydantic, so
# core_api applies the same defaults itself. Keep these in lockstep with
# server.py's request models.

_OPTIMIZE_DEFAULTS = {
    "target_duration": 5.0,
    "capital": 100_000,
    "max_allocation": 0.2,
    "objective_type": "Maximize Yield",
    "risk_free_rate": 0.01,
    "max_junk_bond_allocation": 0.3,
    "max_sector_allocation": 0.25,
    "junk_bond_ratings": ["BB", "B", "CCC", "D"],
    "data_source": "real",
}

_FRONTIER_DEFAULTS = {
    "capital": 100_000,
    "max_allocation": 0.2,
    "max_junk_bond_allocation": 0.3,
    "max_sector_allocation": 0.25,
    "junk_bond_ratings": ["BB", "B", "CCC", "D"],
    "risk_free_rate": 0.01,
    "data_source": "real",
}

_MONTE_CARLO_DEFAULTS = {
    "target_duration": 5.0,
    "capital": 100_000,
    "max_allocation": 0.2,
    "objective_type": "Optimize Sharpe Ratio",
    "risk_free_rate": 0.01,
    "max_junk_bond_allocation": 0.3,
    "max_sector_allocation": 0.25,
    "junk_bond_ratings": ["BB", "B", "CCC", "D"],
    "n_simulations": 10_000,
    "time_horizon_days": 252,
    "data_source": "real",
}

_STRESS_DEFAULTS = {
    "target_duration": 5.0,
    "capital": 100_000,
    "max_allocation": 0.2,
    "objective_type": "Optimize Sharpe Ratio",
    "risk_free_rate": 0.01,
    "max_junk_bond_allocation": 0.3,
    "max_sector_allocation": 0.25,
    "junk_bond_ratings": ["BB", "B", "CCC", "D"],
    "scenarios": None,
    "data_source": "real",
}

_BACKTEST_DEFAULTS = {
    "target_duration": 5.0,
    "capital": 100_000,
    "max_allocation": 0.2,
    "objective_type": "Optimize Sharpe Ratio",
    "risk_free_rate": 0.01,
    "max_junk_bond_allocation": 0.3,
    "max_sector_allocation": 0.25,
    "junk_bond_ratings": ["BB", "B", "CCC", "D"],
    "n_periods": 12,
    "period_type": "monthly",
    "data_source": "real",
}


def _with_defaults(params, defaults):
    """Merge caller params over defaults. None values fall back to default."""
    merged = dict(defaults)
    if params:
        for k, v in params.items():
            if v is not None or k not in merged:
                merged[k] = v
    return merged


def _get_market_df(data_source="real"):
    """Gets bond market data from specified source."""
    return data_loader.generate_bond_market(data_source=data_source)


# --- Memoized solve ---
# A single Optimize click fires optimize + monte_carlo + stress_test + backtest,
# each re-running the identical SLSQP/linprog solve. Memoize so the 4 redundant
# solves collapse to one. Keyed by every solver-affecting parameter. 10-min TTL.
# (In the browser the worker is single-threaded; the lock is a cheap no-op there
# and keeps the CPython parity oracle correct under FastAPI's threadpool.)

_SOLVE_TTL = 600
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
        for k in [
            k for k, v in _solve_cache.items()
            if (now - v["timestamp"]) >= _SOLVE_TTL
        ]:
            _solve_cache.pop(k, None)

    return (results_df.copy() if results_df is not None else None), metrics


# --- Endpoint-equivalent functions ---

def yield_curve() -> dict:
    """Nelson-Siegel parameters and the fitted yield curve data."""
    rates_data = data_loader.fetch_real_treasury_rates()
    beta0, beta1, beta2, lambda_ = rates_data["ns_params"]

    maturities_plot = np.linspace(0.25, 30.0, 100).tolist()
    curve_yields = [
        float(data_loader.nelson_siegel(t, beta0, beta1, beta2, lambda_))
        for t in maturities_plot
    ]

    return {
        "ns_params": {
            "beta0": beta0,
            "beta1": beta1,
            "beta2": beta2,
            "lambda": lambda_,
        },
        "data_points": {
            "maturities": rates_data["maturities"],
            "rates": rates_data["rates"],
        },
        "curve": {
            "maturities": maturities_plot,
            "yields": curve_yields,
        },
    }


def bonds(source: str = "real") -> dict:
    """Bond market data from selected source."""
    market_df = _get_market_df(source)
    bond_records = market_df.to_dict(orient="records")

    return {
        "bonds": bond_records,
        "summary": {
            "total": len(market_df),
            "avg_yield": float(market_df["Yield"].mean()),
            "sectors": int(market_df["Sector"].nunique()),
            "ratings": sorted(market_df["Rating"].unique().tolist()),
        },
        "data_source": source,
    }


def optimize(params: dict) -> dict:
    """Runs the portfolio optimization solver."""
    req = _with_defaults(params, _OPTIMIZE_DEFAULTS)
    results_df, metrics = _run_optimization(req)

    if results_df is not None:
        portfolio = results_df[[
            "Bond_ID", "Company", "Sector", "Rating", "Yield", "Duration",
            "Volatility", "Allocation %", "Investment ($)",
        ]].to_dict(orient="records")

        rating_alloc = results_df.groupby("Rating")["Allocation %"].sum().reset_index().to_dict(orient="records")
        sector_alloc = results_df.groupby("Sector")["Allocation %"].sum().reset_index().to_dict(orient="records")
        company_alloc = results_df.groupby("Company")["Allocation %"].sum().reset_index().to_dict(orient="records")

        return {
            "success": True,
            "portfolio": portfolio,
            "metrics": metrics,
            "allocations": {
                "by_rating": rating_alloc,
                "by_sector": sector_alloc,
                "by_company": company_alloc,
            },
            "data_source": req["data_source"],
        }
    return {"success": False, "error": str(metrics)}


def efficient_frontier(params: dict) -> dict:
    """Generates the efficient frontier by sweeping duration targets."""
    req = _with_defaults(params, _FRONTIER_DEFAULTS)
    market_df = _get_market_df(req["data_source"])

    frontier = brain.generate_efficient_frontier(
        market_df.copy(),
        capital=req["capital"],
        max_alloc=req["max_allocation"],
        max_junk=req["max_junk_bond_allocation"],
        max_sector=req["max_sector_allocation"],
        junk_ratings=req["junk_bond_ratings"],
        risk_free_rate=req["risk_free_rate"],
    )

    return {"frontier": frontier}


def monte_carlo(params: dict) -> dict:
    """Monte Carlo simulation on the optimized portfolio (VaR, CVaR, P&L)."""
    req = _with_defaults(params, _MONTE_CARLO_DEFAULTS)
    market_df = _get_market_df(req["data_source"])

    results_df, metrics = _run_optimization(req, market_df)
    if results_df is None:
        return {"success": False, "error": str(metrics)}

    weights = results_df["Allocation %"].values / 100.0
    weights = weights / weights.sum()

    cov_matrix = data_loader.generate_covariance_matrix(results_df)

    mc_results = risk_engine.run_monte_carlo(
        weights=weights,
        expected_returns=results_df["Yield"].values,
        cov_matrix=cov_matrix,
        capital=req["capital"],
        n_simulations=req["n_simulations"],
        time_horizon_days=req["time_horizon_days"],
    )

    return {"success": True, **mc_results}


def stress_test(params: dict) -> dict:
    """Stress test scenarios on the optimized portfolio."""
    req = _with_defaults(params, _STRESS_DEFAULTS)
    market_df = _get_market_df(req["data_source"])

    results_df, metrics = _run_optimization(req, market_df)
    if results_df is None:
        return {"success": False, "error": str(metrics)}

    weights = results_df["Allocation %"].values / 100.0
    weights = weights / weights.sum()

    stress_results = risk_engine.run_stress_test(
        portfolio_df=results_df,
        weights=weights,
        capital=req["capital"],
        scenarios=req["scenarios"],
        risk_free_rate=req["risk_free_rate"],
    )

    return {"success": True, **stress_results}


def backtest(params: dict) -> dict:
    """Backtest vs equal-weight and risk-free benchmarks."""
    req = _with_defaults(params, _BACKTEST_DEFAULTS)
    market_df = _get_market_df(req["data_source"])

    results_df, metrics = _run_optimization(req, market_df)
    if results_df is None:
        return {"success": False, "error": str(metrics)}

    weights = results_df["Allocation %"].values / 100.0
    weights = weights / weights.sum()

    bt_results = risk_engine.run_backtest(
        portfolio_df=results_df,
        weights=weights,
        capital=req["capital"],
        n_periods=req["n_periods"],
        period_type=req["period_type"],
        risk_free_rate=req["risk_free_rate"],
    )

    return {"success": True, **bt_results}


def stress_scenarios() -> dict:
    """Available stress test scenario definitions."""
    return {"scenarios": risk_engine.STRESS_SCENARIOS}


# --- Prewarm ---
# A single Optimize click produces two distinct solves: optimize defaults to
# "Maximize Yield" (fast linprog), while monte_carlo/stress_test/backtest
# default to "Optimize Sharpe Ratio" (slow SLSQP). Warming both default
# parameter sets makes the first user click a cache hit.

_PREWARM_DEFAULTS = [
    {**_OPTIMIZE_DEFAULTS},
    {**_MONTE_CARLO_DEFAULTS, "objective_type": "Optimize Sharpe Ratio"},
]


def prewarm() -> None:
    """Best-effort: warm the solve cache. A failure here must never raise."""
    for params in _PREWARM_DEFAULTS:
        try:
            _run_optimization(params)
        except Exception:
            pass
