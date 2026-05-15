"""
scripts/sync_frontend_assets.py — stage Python + data as static assets.

The browser worker fetches the math modules and data files from Vercel's static
hosting and writes them into Pyodide's virtual FS. This copies the canonical
root copies into frontend/public/ so there is exactly one source of truth
(root) and the public/ copies are generated, never hand-edited.

Also stamps data_meta.json with the treasury snapshot date so the UI can show
an honest "Data as of <date>" label.

Usage:  python scripts/sync_frontend_assets.py
"""

import datetime
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "frontend", "public")
PY_DEST = os.path.join(PUBLIC, "py")
DATA_DEST = os.path.join(PUBLIC, "data")

# Python modules the Pyodide worker imports (core_api pulls the rest in).
PY_MODULES = [
    "core_api.py",
    "brain.py",
    "data_loader.py",
    "real_data_loader.py",
    "risk_engine.py",
]

DATA_FILES = [
    "real_bonds.csv",
    "treasury_snapshot.json",
]


def main() -> int:
    os.makedirs(PY_DEST, exist_ok=True)
    os.makedirs(DATA_DEST, exist_ok=True)

    for mod in PY_MODULES:
        shutil.copy2(os.path.join(ROOT, mod), os.path.join(PY_DEST, mod))

    for f in DATA_FILES:
        shutil.copy2(os.path.join(ROOT, "data", f), os.path.join(DATA_DEST, f))

    # Derive the "data as of" date from the treasury snapshot timestamp.
    snap_path = os.path.join(ROOT, "data", "treasury_snapshot.json")
    with open(snap_path) as fh:
        snap = json.load(fh)
    ts = float(snap.get("timestamp", 0) or 0)
    if ts > 0:
        as_of = datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
    else:
        as_of = datetime.date.today().isoformat()

    # No volatile fields here: data_meta.json is committed, so it must only
    # change when the underlying data actually changes (keeps diffs honest).
    meta = {
        "data_as_of": as_of,
        "bond_universe": "Curated FINRA TRACE corporate bond snapshot",
        "treasury_source": "U.S. Treasury via yfinance, refreshed at deploy time",
    }
    with open(os.path.join(DATA_DEST, "data_meta.json"), "w") as fh:
        json.dump(meta, fh, indent=2)

    print(f"Synced {len(PY_MODULES)} py modules → {PY_DEST}")
    print(f"Synced {len(DATA_FILES)} data files → {DATA_DEST}")
    print(f"data_meta.json: data_as_of={as_of}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
