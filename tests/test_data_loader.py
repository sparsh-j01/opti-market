"""
Test suite for data_loader.py and real_data_loader.py
"""

import pytest
import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import data_loader
import real_data_loader


class TestSyntheticBondGeneration:
    def test_generates_correct_count(self):
        df = data_loader.generate_bond_market(n_bonds=50, data_source="synthetic")
        assert len(df) == 50

    def test_default_count(self):
        data_loader._bond_market_cache = {"data": None, "timestamp": 0}
        df = data_loader.generate_bond_market(data_source="synthetic")
        assert len(df) == 150

    def test_required_columns(self):
        df = data_loader.generate_bond_market(n_bonds=10, data_source="synthetic")
        required = ["Bond_ID", "Company", "Sector", "Rating", "Duration", "Yield", "Volatility", "Price"]
        for col in required:
            assert col in df.columns

    def test_yield_positive(self):
        df = data_loader.generate_bond_market(n_bonds=50, data_source="synthetic")
        assert (df["Yield"] > 0).all()

    def test_duration_range(self):
        df = data_loader.generate_bond_market(n_bonds=50, data_source="synthetic")
        assert (df["Duration"] >= 0.5).all()
        assert (df["Duration"] <= 20).all()

    def test_volatility_positive(self):
        df = data_loader.generate_bond_market(n_bonds=50, data_source="synthetic")
        assert (df["Volatility"] > 0).all()

    def test_reproducibility(self):
        """Synthetic bonds should be reproducible with fixed seed."""
        data_loader._bond_market_cache = {"data": None, "timestamp": 0}
        df1 = data_loader.generate_bond_market(n_bonds=10, data_source="synthetic")
        data_loader._bond_market_cache = {"data": None, "timestamp": 0}
        df2 = data_loader.generate_bond_market(n_bonds=10, data_source="synthetic")
        pd.testing.assert_frame_equal(df1, df2)


class TestRealBondData:
    def test_loads_csv(self):
        df = real_data_loader.load_real_bonds()
        assert len(df) > 0

    def test_required_columns(self):
        df = real_data_loader.load_real_bonds()
        required = ["Bond_ID", "Company", "Sector", "Rating", "Duration", "Yield", "Volatility"]
        for col in required:
            assert col in df.columns, f"Missing column: {col}"

    def test_real_cusips(self):
        """Bond IDs should be real CUSIPs (alphanumeric, 9+ chars)."""
        df = real_data_loader.load_real_bonds()
        for bond_id in df["Bond_ID"]:
            assert len(str(bond_id)) >= 9, f"CUSIP too short: {bond_id}"

    def test_real_companies(self):
        """Should have well-known company names."""
        df = real_data_loader.load_real_bonds()
        companies = df["Company"].unique()
        known = {"Apple Inc", "Microsoft Corp", "JPMorgan Chase"}
        assert len(known & set(companies)) > 0

    def test_data_source_toggle(self):
        """data_loader should switch between real and synthetic."""
        real_df = data_loader.generate_bond_market(data_source="real")
        syn_df = data_loader.generate_bond_market(data_source="synthetic")
        # Real data should have CUSIPs, synthetic should have generated IDs
        assert len(str(real_df.iloc[0]["Bond_ID"])) >= 9
        assert len(str(syn_df.iloc[0]["Bond_ID"])) < 9

    def test_data_source_info(self):
        info = real_data_loader.get_data_source_info()
        assert "source" in info
        assert "FINRA" in info["source"]


class TestNelsonSiegel:
    def test_basic_curve(self):
        """NS curve should produce reasonable yields."""
        y = data_loader.nelson_siegel(5.0, 0.05, -0.01, 0.01, 0.5)
        assert 0.0 < y < 0.2

    def test_monotonic_for_typical_params(self):
        """With typical params, longer maturities should have higher yields."""
        maturities = [1.0, 5.0, 10.0, 30.0]
        yields = [data_loader.nelson_siegel(t, 0.05, -0.02, 0.01, 0.5) for t in maturities]
        # Generally upward sloping (may not be strictly monotonic)
        assert yields[-1] > yields[0]
