"""
Test suite for brain.py - optimization engine correctness tests.
"""

import pytest
import numpy as np
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import brain
import data_loader


@pytest.fixture
def sample_bonds():
    """Create a small bond DataFrame for testing."""
    return pd.DataFrame({
        "Bond_ID": ["B001", "B002", "B003", "B004", "B005"],
        "Company": ["Apple", "Microsoft", "JPMorgan", "Boeing", "Pfizer"],
        "Sector": ["Technology", "Technology", "Financials", "Industrials", "Healthcare"],
        "Rating": ["AA", "AAA", "A", "BBB", "AA"],
        "Duration": [3.0, 5.0, 7.0, 4.0, 6.0],
        "Yield": [0.04, 0.045, 0.05, 0.06, 0.042],
        "Volatility": [0.05, 0.06, 0.08, 0.12, 0.055],
        "Price": [98.5, 97.2, 96.8, 95.5, 97.5],
    })


class TestPortfolioMetrics:
    def test_portfolio_expected_return(self):
        weights = np.array([0.3, 0.4, 0.3])
        returns = np.array([0.05, 0.06, 0.04])
        result = brain.portfolio_expected_return(weights, returns)
        assert abs(result - 0.051) < 1e-10

    def test_portfolio_volatility(self):
        weights = np.array([0.5, 0.5])
        cov = np.array([[0.04, 0.01], [0.01, 0.09]])
        vol = brain.portfolio_volatility(weights, cov)
        expected = np.sqrt(0.5**2 * 0.04 + 0.5**2 * 0.09 + 2 * 0.5 * 0.5 * 0.01)
        assert abs(vol - expected) < 1e-10

    def test_volatility_zero_weights(self):
        weights = np.array([0.0, 0.0])
        cov = np.array([[0.04, 0.01], [0.01, 0.09]])
        vol = brain.portfolio_volatility(weights, cov)
        assert vol == 0.0

    def test_negative_sharpe(self):
        weights = np.array([0.5, 0.5])
        returns = np.array([0.05, 0.06])
        cov = np.array([[0.04, 0.01], [0.01, 0.09]])
        neg_sharpe = brain.negative_sharpe_ratio(weights, returns, cov, 0.02)
        assert neg_sharpe < 0  # Should be negative since return > Rf


class TestOptimizer:
    def test_maximize_yield_basic(self, sample_bonds):
        result_df, metrics = brain.run_solver(
            sample_bonds, target_duration=5.0, capital=100000,
            max_allocation=0.5, objective_type="Maximize Yield"
        )
        assert result_df is not None
        assert isinstance(metrics, dict)
        assert "Portfolio Yield" in metrics
        assert metrics["Portfolio Yield"] > 0

    def test_sharpe_ratio_basic(self, sample_bonds):
        result_df, metrics = brain.run_solver(
            sample_bonds, target_duration=5.0, capital=100000,
            max_allocation=0.5, objective_type="Optimize Sharpe Ratio"
        )
        assert result_df is not None
        assert isinstance(metrics, dict)
        assert "Sharpe Ratio" in metrics

    def test_weights_sum_to_one(self, sample_bonds):
        result_df, metrics = brain.run_solver(
            sample_bonds, target_duration=5.0, capital=100000,
            max_allocation=0.5, objective_type="Maximize Yield"
        )
        if result_df is not None:
            total_alloc = result_df["Allocation %"].sum()
            assert abs(total_alloc - 100.0) < 1.0  # Should be ~100%

    def test_allocation_within_bounds(self, sample_bonds):
        max_alloc = 0.3
        result_df, metrics = brain.run_solver(
            sample_bonds, target_duration=5.0, capital=100000,
            max_allocation=max_alloc, objective_type="Maximize Yield"
        )
        if result_df is not None:
            for _, row in result_df.iterrows():
                assert row["Allocation %"] <= max_alloc * 100 + 0.1

    def test_duration_matching(self, sample_bonds):
        target = 5.0
        result_df, metrics = brain.run_solver(
            sample_bonds, target_duration=target, capital=100000,
            max_allocation=0.5, objective_type="Maximize Yield"
        )
        if result_df is not None and isinstance(metrics, dict):
            assert abs(metrics["Portfolio Duration"] - target) < 0.5

    def test_invalid_objective(self, sample_bonds):
        result, msg = brain.run_solver(
            sample_bonds, target_duration=5.0, capital=100000,
            objective_type="Invalid"
        )
        assert result is None
        assert "Invalid" in str(msg)

    def test_capital_allocation(self, sample_bonds):
        capital = 50000
        result_df, metrics = brain.run_solver(
            sample_bonds, target_duration=5.0, capital=capital,
            max_allocation=0.5, objective_type="Maximize Yield"
        )
        if result_df is not None:
            total_invested = result_df["Investment ($)"].sum()
            assert total_invested <= capital * 1.01


class TestCovarianceMatrix:
    def test_covariance_shape(self, sample_bonds):
        cov = data_loader.generate_covariance_matrix(sample_bonds)
        n = len(sample_bonds)
        assert cov.shape == (n, n)

    def test_covariance_symmetric(self, sample_bonds):
        cov = data_loader.generate_covariance_matrix(sample_bonds)
        assert np.allclose(cov, cov.T)

    def test_covariance_positive_diagonal(self, sample_bonds):
        cov = data_loader.generate_covariance_matrix(sample_bonds)
        assert np.all(np.diag(cov) > 0)

    def test_same_sector_higher_correlation(self, sample_bonds):
        cov = data_loader.generate_covariance_matrix(sample_bonds)
        # Apple (0) and Microsoft (1) are both Technology
        # Boeing (3) is Industrials
        corr_same = cov[0, 1] / (np.sqrt(cov[0, 0]) * np.sqrt(cov[1, 1]))
        corr_diff = cov[0, 3] / (np.sqrt(cov[0, 0]) * np.sqrt(cov[3, 3]))
        assert corr_same > corr_diff


class TestEfficientFrontier:
    def test_frontier_generation(self, sample_bonds):
        frontier = brain.generate_efficient_frontier(
            sample_bonds, capital=100000, max_alloc=0.5,
            max_junk=0.3, max_sector=0.5,
            junk_ratings=["BB", "B", "CCC", "D"],
            risk_free_rate=0.01
        )
        assert isinstance(frontier, list)
        # Should have at least some valid points
        if len(frontier) > 0:
            assert "Yield" in frontier[0]
            assert "Volatility" in frontier[0]
            assert "Sharpe Ratio" in frontier[0]
