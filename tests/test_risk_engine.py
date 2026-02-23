"""
Test suite for risk_engine.py - Monte Carlo, stress testing, backtesting.
"""

import pytest
import numpy as np
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import risk_engine
import data_loader


@pytest.fixture
def portfolio():
    """Create a small portfolio for testing."""
    df = pd.DataFrame({
        "Bond_ID": ["B001", "B002", "B003"],
        "Company": ["Apple", "Microsoft", "JPMorgan"],
        "Sector": ["Technology", "Technology", "Financials"],
        "Rating": ["AA", "AAA", "A"],
        "Duration": [3.0, 5.0, 7.0],
        "Yield": [0.04, 0.045, 0.05],
        "Volatility": [0.05, 0.06, 0.08],
        "Price": [98.5, 97.2, 96.8],
    })
    weights = np.array([0.3, 0.4, 0.3])
    return df, weights


class TestMonteCarlo:
    def test_basic_run(self, portfolio):
        df, weights = portfolio
        cov = data_loader.generate_covariance_matrix(df)
        result = risk_engine.run_monte_carlo(
            weights, df["Yield"].values, cov,
            capital=100000, n_simulations=1000
        )
        assert "var_cvar" in result
        assert "histogram" in result
        assert "95%" in result["var_cvar"]
        assert result["n_simulations"] == 1000

    def test_var_positive(self, portfolio):
        df, weights = portfolio
        cov = data_loader.generate_covariance_matrix(df)
        result = risk_engine.run_monte_carlo(
            weights, df["Yield"].values, cov,
            capital=100000, n_simulations=5000
        )
        assert result["var_cvar"]["95%"]["VaR_dollar"] >= 0

    def test_cvar_geq_var(self, portfolio):
        """CVaR should always be >= VaR."""
        df, weights = portfolio
        cov = data_loader.generate_covariance_matrix(df)
        result = risk_engine.run_monte_carlo(
            weights, df["Yield"].values, cov,
            capital=100000, n_simulations=5000
        )
        for level in ["90%", "95%", "99%"]:
            assert result["var_cvar"][level]["CVaR_dollar"] >= result["var_cvar"][level]["VaR_dollar"]

    def test_histogram_bins(self, portfolio):
        df, weights = portfolio
        cov = data_loader.generate_covariance_matrix(df)
        result = risk_engine.run_monte_carlo(
            weights, df["Yield"].values, cov, n_simulations=1000
        )
        assert len(result["histogram"]) == 50
        total_count = sum(b["count"] for b in result["histogram"])
        assert total_count == 1000


class TestStressTest:
    def test_all_scenarios(self, portfolio):
        df, weights = portfolio
        result = risk_engine.run_stress_test(df, weights, capital=100000)
        assert "scenarios" in result
        assert len(result["scenarios"]) == 7

    def test_specific_scenarios(self, portfolio):
        df, weights = portfolio
        result = risk_engine.run_stress_test(
            df, weights, capital=100000,
            scenarios=["rate_shock_up_200", "credit_crisis"]
        )
        assert len(result["scenarios"]) == 2

    def test_rate_shock_negative_pnl(self, portfolio):
        """Rising rates should cause negative price impact for a bond portfolio."""
        df, weights = portfolio
        result = risk_engine.run_stress_test(
            df, weights, capital=100000,
            scenarios=["rate_shock_up_200"]
        )
        scenario = result["scenarios"][0]
        assert scenario["price_impact_pct"] < 0

    def test_base_portfolio_included(self, portfolio):
        df, weights = portfolio
        result = risk_engine.run_stress_test(df, weights, capital=100000)
        assert "base_portfolio" in result
        assert result["base_portfolio"]["yield"] > 0


class TestBacktest:
    def test_basic_run(self, portfolio):
        df, weights = portfolio
        result = risk_engine.run_backtest(df, weights, capital=100000)
        assert "time_series" in result
        assert "summary" in result
        assert len(result["time_series"]) == 13  # 12 periods + start

    def test_starts_at_capital(self, portfolio):
        df, weights = portfolio
        capital = 50000
        result = risk_engine.run_backtest(df, weights, capital=capital)
        first_point = result["time_series"][0]
        assert first_point["optimized"] == capital
        assert first_point["equal_weight"] == capital
        assert first_point["risk_free"] == capital

    def test_risk_free_always_positive(self, portfolio):
        df, weights = portfolio
        result = risk_engine.run_backtest(df, weights, capital=100000)
        for point in result["time_series"]:
            assert point["risk_free"] >= 100000  # RF should never decrease

    def test_summary_has_alpha(self, portfolio):
        df, weights = portfolio
        result = risk_engine.run_backtest(df, weights, capital=100000)
        assert "alpha_vs_benchmark" in result["summary"]
        assert "alpha_vs_riskfree" in result["summary"]
