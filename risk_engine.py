"""
risk_engine.py
Advanced risk analytics: Monte Carlo simulation, stress testing, and backtesting.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Optional
import data_loader


# ===========================================================================
# 1. MONTE CARLO SIMULATION — VaR & CVaR
# ===========================================================================

def run_monte_carlo(
    weights: np.ndarray,
    expected_returns: np.ndarray,
    cov_matrix: np.ndarray,
    capital: float = 100000,
    n_simulations: int = 10000,
    time_horizon_days: int = 252,
    confidence_levels: List[float] = None,
) -> dict:
    """
    Runs Monte Carlo simulation to estimate portfolio risk metrics.
    
    Uses Cholesky decomposition of the covariance matrix to generate
    correlated random returns, then computes VaR and CVaR.
    
    Parameters:
        weights: Portfolio weights (must sum to 1)
        expected_returns: Annual expected returns per bond
        cov_matrix: N×N covariance matrix
        capital: Initial investment amount
        n_simulations: Number of simulation paths
        time_horizon_days: Holding period in trading days
        confidence_levels: VaR confidence levels (e.g., [0.95, 0.99])
    
    Returns:
        Dictionary with simulation results, VaR, CVaR, and distribution data
    """
    if confidence_levels is None:
        confidence_levels = [0.90, 0.95, 0.99]
    
    n_assets = len(weights)
    dt = time_horizon_days / 252.0
    
    # Annualized portfolio return and volatility
    port_return = np.sum(weights * expected_returns)
    port_vol = np.sqrt(weights.T @ cov_matrix @ weights)
    
    # Generate correlated random returns using Cholesky decomposition
    try:
        L = np.linalg.cholesky(cov_matrix + np.eye(n_assets) * 1e-8)
    except np.linalg.LinAlgError:
        # Fallback: use diagonal if Cholesky fails
        L = np.diag(np.sqrt(np.diag(cov_matrix)))
    
    # Simulate portfolio returns (GBM: geometric Brownian motion)
    Z = np.random.standard_normal((n_simulations, n_assets))
    correlated_returns = Z @ L.T
    correlated_returns = np.clip(correlated_returns, -10, 10)  # Prevent overflow
    
    # Portfolio-level returns for each simulation
    daily_port_returns = correlated_returns @ weights
    
    # Scale to time horizon
    portfolio_returns = daily_port_returns * np.sqrt(dt) + (port_return - 0.5 * port_vol**2) * dt
    
    # Terminal portfolio values
    terminal_values = capital * np.exp(portfolio_returns)
    pnl = terminal_values - capital
    
    # Sort for quantile computation
    sorted_pnl = np.sort(pnl)
    sorted_returns = np.sort(portfolio_returns)
    
    # Compute VaR and CVaR at each confidence level
    var_results = {}
    for cl in confidence_levels:
        idx = int((1 - cl) * n_simulations)
        var_dollar = -sorted_pnl[idx]
        cvar_dollar = -np.mean(sorted_pnl[:idx]) if idx > 0 else var_dollar
        var_pct = -sorted_returns[idx]
        cvar_pct = -np.mean(sorted_returns[:idx]) if idx > 0 else var_pct
        
        var_results[f"{int(cl*100)}%"] = {
            "VaR_dollar": round(float(var_dollar), 2),
            "CVaR_dollar": round(float(cvar_dollar), 2),
            "VaR_percent": round(float(var_pct * 100), 2),
            "CVaR_percent": round(float(cvar_pct * 100), 2),
        }
    
    # Build histogram data for frontend
    hist_counts, hist_edges = np.histogram(pnl, bins=50)
    histogram = [
        {
            "bin_start": round(float(hist_edges[i]), 2),
            "bin_end": round(float(hist_edges[i+1]), 2),
            "bin_mid": round(float((hist_edges[i] + hist_edges[i+1]) / 2), 2),
            "count": int(hist_counts[i]),
            "frequency": round(float(hist_counts[i]) / n_simulations, 4),
        }
        for i in range(len(hist_counts))
    ]
    
    return {
        "n_simulations": n_simulations,
        "time_horizon_days": time_horizon_days,
        "capital": capital,
        "expected_return_annual": round(float(port_return * 100), 2),
        "expected_volatility_annual": round(float(port_vol * 100), 2),
        "mean_pnl": round(float(np.mean(pnl)), 2),
        "median_pnl": round(float(np.median(pnl)), 2),
        "std_pnl": round(float(np.std(pnl)), 2),
        "min_pnl": round(float(np.min(pnl)), 2),
        "max_pnl": round(float(np.max(pnl)), 2),
        "prob_loss": round(float(np.mean(pnl < 0) * 100), 2),
        "var_cvar": var_results,
        "histogram": histogram,
        "percentiles": {
            "p1": round(float(np.percentile(pnl, 1)), 2),
            "p5": round(float(np.percentile(pnl, 5)), 2),
            "p10": round(float(np.percentile(pnl, 10)), 2),
            "p25": round(float(np.percentile(pnl, 25)), 2),
            "p50": round(float(np.percentile(pnl, 50)), 2),
            "p75": round(float(np.percentile(pnl, 75)), 2),
            "p90": round(float(np.percentile(pnl, 90)), 2),
            "p95": round(float(np.percentile(pnl, 95)), 2),
            "p99": round(float(np.percentile(pnl, 99)), 2),
        },
    }


# ===========================================================================
# 2. STRESS TESTING — Scenario Analysis
# ===========================================================================

STRESS_SCENARIOS = {
    "rate_shock_up_200": {
        "name": "Rate Shock +200bp",
        "description": "Parallel shift in yields up by 200 basis points",
        "yield_shift": 0.02,
        "spread_multiplier": 1.0,
        "volatility_multiplier": 1.5,
    },
    "rate_shock_up_100": {
        "name": "Rate Shock +100bp",
        "description": "Parallel shift in yields up by 100 basis points",
        "yield_shift": 0.01,
        "spread_multiplier": 1.0,
        "volatility_multiplier": 1.2,
    },
    "rate_shock_down_100": {
        "name": "Rate Shock -100bp",
        "description": "Parallel shift in yields down by 100 basis points",
        "yield_shift": -0.01,
        "spread_multiplier": 1.0,
        "volatility_multiplier": 1.1,
    },
    "credit_crisis": {
        "name": "Credit Crisis",
        "description": "Credit spreads widen 3x, high-yield volatility spikes",
        "yield_shift": 0.005,
        "spread_multiplier": 3.0,
        "volatility_multiplier": 2.0,
    },
    "flight_to_quality": {
        "name": "Flight to Quality",
        "description": "Treasuries rally, investment-grade tightens, junk widens",
        "yield_shift": -0.015,
        "spread_multiplier": 0.7,  # IG spreads tighten
        "hy_spread_multiplier": 2.5,  # HY spreads widen
        "volatility_multiplier": 1.8,
    },
    "stagflation": {
        "name": "Stagflation",
        "description": "Rates rise with widening credit spreads across all tiers",
        "yield_shift": 0.015,
        "spread_multiplier": 1.8,
        "volatility_multiplier": 1.6,
    },
    "2008_replay": {
        "name": "2008 Crisis Replay",
        "description": "Extreme credit spread widening, rates cut, volatility spike",
        "yield_shift": -0.02,
        "spread_multiplier": 5.0,
        "volatility_multiplier": 3.0,
    },
}

IG_RATINGS = {"AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-"}

def _get_credit_spread(rating: str) -> float:
    """Returns approximate credit spread for a rating."""
    spreads = {
        "AAA": 0.005, "AA+": 0.006, "AA": 0.007, "AA-": 0.008,
        "A+": 0.009, "A": 0.010, "A-": 0.012,
        "BBB+": 0.014, "BBB": 0.017, "BBB-": 0.020,
        "BB": 0.035, "B": 0.050, "CCC": 0.085, "D": 0.120,
    }
    return spreads.get(rating, 0.015)


def run_stress_test(
    portfolio_df: pd.DataFrame,
    weights: np.ndarray,
    capital: float,
    scenarios: List[str] = None,
) -> dict:
    """
    Runs stress test scenarios on the portfolio.
    
    For each scenario, adjusts yields and volatilities based on the shock,
    then computes the new portfolio value and P&L impact.
    
    Parameters:
        portfolio_df: DataFrame of bonds in the portfolio
        weights: Portfolio weights
        capital: Total capital invested
        scenarios: List of scenario keys to run (default: all)
    
    Returns:
        Dictionary with scenario results
    """
    if scenarios is None:
        scenarios = list(STRESS_SCENARIOS.keys())
    
    base_yield = float(np.sum(weights * portfolio_df['Yield'].values))
    base_duration = float(np.sum(weights * portfolio_df['Duration'].values))
    
    cov_matrix = data_loader.generate_covariance_matrix(portfolio_df)
    base_vol = float(np.sqrt(weights.T @ cov_matrix @ weights))
    
    if base_vol > 0:
        base_sharpe = (base_yield - 0.04) / base_vol  # Assume 4% Rf
    else:
        base_sharpe = 0.0
    
    results = []
    
    for scenario_key in scenarios:
        if scenario_key not in STRESS_SCENARIOS:
            continue
        
        scenario = STRESS_SCENARIOS[scenario_key]
        
        # Apply yield shocks
        stressed_yields = portfolio_df['Yield'].values.copy()
        
        for i, rating in enumerate(portfolio_df['Rating'].values):
            base_spread = _get_credit_spread(rating)
            yield_shift = scenario["yield_shift"]
            
            # Apply spread multiplier
            is_ig = rating in IG_RATINGS
            spread_mult = scenario.get("spread_multiplier", 1.0)
            
            # For flight-to-quality, HY and IG have different multipliers
            if "hy_spread_multiplier" in scenario and not is_ig:
                spread_mult = scenario["hy_spread_multiplier"]
            
            new_spread = base_spread * spread_mult
            spread_change = new_spread - base_spread
            
            stressed_yields[i] = max(stressed_yields[i] + yield_shift + spread_change, 0.001)
        
        # Price impact using duration approximation: ΔP/P ≈ -D × Δy
        yield_changes = stressed_yields - portfolio_df['Yield'].values
        weighted_yield_change = float(np.sum(weights * yield_changes))
        
        # Price change (duration-based)
        price_impact_pct = -base_duration * weighted_yield_change
        pnl_dollar = capital * price_impact_pct
        
        # Stressed volatility
        vol_mult = scenario.get("volatility_multiplier", 1.0)
        stressed_vol = base_vol * vol_mult
        
        stressed_yield = float(np.sum(weights * stressed_yields))
        if stressed_vol > 0:
            stressed_sharpe = (stressed_yield - 0.04) / stressed_vol
        else:
            stressed_sharpe = 0.0
        
        results.append({
            "scenario": scenario_key,
            "name": scenario["name"],
            "description": scenario["description"],
            "base_yield": round(base_yield * 100, 2),
            "stressed_yield": round(stressed_yield * 100, 2),
            "yield_change_bp": round(weighted_yield_change * 10000, 1),
            "price_impact_pct": round(price_impact_pct * 100, 2),
            "pnl_dollar": round(pnl_dollar, 2),
            "base_volatility": round(base_vol * 100, 2),
            "stressed_volatility": round(stressed_vol * 100, 2),
            "base_sharpe": round(base_sharpe, 3),
            "stressed_sharpe": round(stressed_sharpe, 3),
        })
    
    return {
        "base_portfolio": {
            "yield": round(base_yield * 100, 2),
            "duration": round(base_duration, 2),
            "volatility": round(base_vol * 100, 2),
            "sharpe": round(base_sharpe, 3),
            "capital": capital,
        },
        "scenarios": results,
    }


# ===========================================================================
# 3. BACKTESTING ENGINE — Historical Simulation
# ===========================================================================

def run_backtest(
    portfolio_df: pd.DataFrame,
    weights: np.ndarray,
    capital: float,
    n_periods: int = 12,
    period_type: str = "monthly",
) -> dict:
    """
    Simulates historical portfolio performance using a random walk
    calibrated to the portfolio's expected return and volatility.
    
    Compares the optimized portfolio against:
    1. Equal-weight benchmark
    2. Treasury-only benchmark (risk-free)
    
    Parameters:
        portfolio_df: DataFrame of portfolio bonds
        weights: Optimized weights
        capital: Starting capital
        n_periods: Number of periods to simulate
        period_type: "monthly" or "quarterly"
    
    Returns:
        Dictionary with time series data for chart rendering
    """
    np.random.seed(42)  # Reproducibility for demo
    
    n_assets = len(portfolio_df)
    cov_matrix = data_loader.generate_covariance_matrix(portfolio_df)
    expected_returns = portfolio_df['Yield'].values
    
    # Time scaling
    if period_type == "monthly":
        dt = 1.0 / 12.0
        period_labels = [f"M{i}" for i in range(n_periods + 1)]
    else:
        dt = 1.0 / 4.0
        period_labels = [f"Q{i}" for i in range(n_periods + 1)]
    
    # Portfolio parameters
    port_return = float(np.sum(weights * expected_returns))
    port_vol = float(np.sqrt(weights.T @ cov_matrix @ weights))
    
    # Equal-weight benchmark
    eq_weights = np.ones(n_assets) / n_assets
    eq_return = float(np.sum(eq_weights * expected_returns))
    eq_vol = float(np.sqrt(eq_weights.T @ cov_matrix @ eq_weights))
    
    # Risk-free rate
    risk_free_rate = 0.04  # Current ~4% Treasury rate
    
    # Simulate paths with correlated shocks
    try:
        L = np.linalg.cholesky(cov_matrix + np.eye(n_assets) * 1e-8)
    except np.linalg.LinAlgError:
        L = np.diag(np.sqrt(np.diag(cov_matrix)))
    
    # Generate common random shocks (same market conditions for fair comparison)
    Z = np.random.standard_normal((n_periods, n_assets))
    correlated_shocks = Z @ L.T
    
    # Build cumulative return series
    opt_values = [capital]
    eq_values = [capital]
    rf_values = [capital]
    
    opt_cum_return = 0.0
    eq_cum_return = 0.0
    
    period_returns_opt = []
    period_returns_eq = []
    
    for t in range(n_periods):
        # Period returns for each asset
        asset_shocks = correlated_shocks[t]
        
        # Optimized portfolio return this period
        opt_period_return = (port_return * dt + 
                            port_vol * np.sqrt(dt) * float(np.sum(weights * asset_shocks)))
        opt_values.append(opt_values[-1] * (1 + opt_period_return))
        period_returns_opt.append(opt_period_return)
        
        # Equal-weight portfolio return this period
        eq_period_return = (eq_return * dt + 
                          eq_vol * np.sqrt(dt) * float(np.sum(eq_weights * asset_shocks)))
        eq_values.append(eq_values[-1] * (1 + eq_period_return))
        period_returns_eq.append(eq_period_return)
        
        # Risk-free return
        rf_values.append(rf_values[-1] * (1 + risk_free_rate * dt))
    
    # Build time series for frontend
    time_series = []
    for i in range(n_periods + 1):
        time_series.append({
            "period": period_labels[i],
            "period_num": i,
            "optimized": round(opt_values[i], 2),
            "equal_weight": round(eq_values[i], 2),
            "risk_free": round(rf_values[i], 2),
        })
    
    # Summary statistics
    total_return_opt = (opt_values[-1] - capital) / capital
    total_return_eq = (eq_values[-1] - capital) / capital
    total_return_rf = (rf_values[-1] - capital) / capital
    
    # Compute max drawdown
    def max_drawdown(values):
        peak = values[0]
        mdd = 0
        for v in values:
            if v > peak:
                peak = v
            dd = (peak - v) / peak
            if dd > mdd:
                mdd = dd
        return mdd
    
    # Annualized Sharpe of realized returns
    if period_returns_opt:
        ann_factor = 12 if period_type == "monthly" else 4
        opt_sharpe = (np.mean(period_returns_opt) * ann_factor - risk_free_rate) / \
                     (np.std(period_returns_opt) * np.sqrt(ann_factor)) if np.std(period_returns_opt) > 0 else 0
        eq_sharpe = (np.mean(period_returns_eq) * ann_factor - risk_free_rate) / \
                    (np.std(period_returns_eq) * np.sqrt(ann_factor)) if np.std(period_returns_eq) > 0 else 0
    else:
        opt_sharpe = 0
        eq_sharpe = 0
    
    return {
        "time_series": time_series,
        "n_periods": n_periods,
        "period_type": period_type,
        "summary": {
            "optimized": {
                "total_return_pct": round(total_return_opt * 100, 2),
                "final_value": round(opt_values[-1], 2),
                "max_drawdown_pct": round(max_drawdown(opt_values) * 100, 2),
                "sharpe_ratio": round(float(opt_sharpe), 3),
                "portfolio_yield": round(port_return * 100, 2),
                "portfolio_volatility": round(port_vol * 100, 2),
            },
            "equal_weight": {
                "total_return_pct": round(total_return_eq * 100, 2),
                "final_value": round(eq_values[-1], 2),
                "max_drawdown_pct": round(max_drawdown(eq_values) * 100, 2),
                "sharpe_ratio": round(float(eq_sharpe), 3),
                "portfolio_yield": round(eq_return * 100, 2),
                "portfolio_volatility": round(eq_vol * 100, 2),
            },
            "risk_free": {
                "total_return_pct": round(total_return_rf * 100, 2),
                "final_value": round(rf_values[-1], 2),
                "rate": round(risk_free_rate * 100, 2),
            },
            "alpha_vs_benchmark": round((total_return_opt - total_return_eq) * 100, 2),
            "alpha_vs_riskfree": round((total_return_opt - total_return_rf) * 100, 2),
        },
    }
