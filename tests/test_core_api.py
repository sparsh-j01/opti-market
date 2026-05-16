"""
core_api contract tests.

core_api is the single source of truth both the FastAPI oracle and the browser
Pyodide worker import. These assert each function returns the exact dict shape
the frontend's TypeScript interfaces expect.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import core_api


def test_optimize_default_shape():
    r = core_api.optimize({})
    assert r["success"] is True
    assert r["data_source"] == "real"
    assert len(r["portfolio"]) > 0
    bond = r["portfolio"][0]
    for k in ("Bond_ID", "Company", "Sector", "Rating", "Yield", "Duration",
              "Volatility", "Allocation %", "Investment ($)"):
        assert k in bond
    for k in ("Portfolio Yield", "Portfolio Duration",
              "Portfolio Volatility", "Sharpe Ratio"):
        assert k in r["metrics"]
    for k in ("by_rating", "by_sector", "by_company"):
        assert k in r["allocations"]


def test_optimize_applies_defaults_for_partial_params():
    r = core_api.optimize({"target_duration": 6.0})
    assert r["success"] is True


def test_optimize_failure_returns_error_not_raise():
    # Infeasible: max_allocation tiny so weights can't sum to 1.
    r = core_api.optimize({"max_allocation": 0.001})
    assert r["success"] is False
    assert isinstance(r["error"], str)


def test_efficient_frontier_shape():
    r = core_api.efficient_frontier({})
    assert "frontier" in r
    assert len(r["frontier"]) > 0
    for k in ("Target Duration", "Yield", "Volatility", "Sharpe Ratio"):
        assert k in r["frontier"][0]


def test_monte_carlo_shape():
    r = core_api.monte_carlo({})
    assert r["success"] is True
    assert "var_cvar" in r
    assert "histogram" in r


def test_stress_test_shape():
    r = core_api.stress_test({})
    assert r["success"] is True
    assert "scenarios" in r


def test_backtest_shape():
    r = core_api.backtest({})
    assert r["success"] is True
    assert "time_series" in r
    assert "summary" in r


def test_yield_curve_shape():
    r = core_api.yield_curve()
    assert set(r["ns_params"]) == {"beta0", "beta1", "beta2", "lambda"}
    assert len(r["curve"]["maturities"]) == 100
    assert len(r["curve"]["yields"]) == 100


def test_bonds_shape():
    r = core_api.bonds("real")
    assert r["data_source"] == "real"
    assert r["summary"]["total"] == len(r["bonds"])
    assert r["summary"]["total"] > 0


def test_stress_scenarios_shape():
    r = core_api.stress_scenarios()
    assert isinstance(r["scenarios"], dict)
    assert len(r["scenarios"]) > 0


def test_server_oracle_matches_core_api():
    """The FastAPI oracle must be a pure pass-through to core_api."""
    from fastapi.testclient import TestClient

    import server

    client = TestClient(server.app)
    resp = client.post("/api/optimize", json={"target_duration": 5.0})
    assert resp.status_code == 200
    direct = core_api.optimize({"target_duration": 5.0})
    assert resp.json()["metrics"] == direct["metrics"]
