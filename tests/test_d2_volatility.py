"""
D2 regression — IRON RULE.

The Volatility column was baked into real_bonds.csv from the old
np.random.default_rng(42) formula. load_real_bonds now READS it instead of
regenerating it. This test asserts the read values equal the old computed
values exactly (golden snapshot captured at bake time). If this ever fails,
the client path is no longer parity-exact with the historical server.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import real_data_loader

_GOLDEN = os.path.join(os.path.dirname(__file__), "fixtures", "d2_volatility_golden.json")


def test_baked_volatility_matches_old_rng_values_exactly():
    with open(_GOLDEN) as f:
        golden = json.load(f)

    df = real_data_loader.load_real_bonds()
    by_id = dict(zip(df["Bond_ID"].astype(str), df["Volatility"]))

    assert set(by_id) == set(golden), "bond universe drifted from golden"
    for bond_id, expected in golden.items():
        assert by_id[bond_id] == expected, (
            f"{bond_id}: read {by_id[bond_id]} != old computed {expected}"
        )


def test_loader_is_rng_free():
    """The loader source must not reintroduce RNG on the client path."""
    src = open(real_data_loader.__file__).read()
    assert "default_rng" not in src
    assert "np.random" not in src
