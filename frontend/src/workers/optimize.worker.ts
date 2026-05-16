/// <reference lib="webworker" />
/**
 * optimize.worker.ts — runs OptiMarket's Python compute in the browser.
 *
 * Loads a self-hosted Pyodide (numpy/scipy/pandas, WASM), writes the canonical
 * .py modules and static data into Pyodide's virtual FS at the exact paths the
 * Python expects, then imports core_api — the SAME module the FastAPI parity
 * oracle imports. Every request runs identical code to the server.
 *
 * Protocol:
 *   main → worker  { type: "init" }
 *   main → worker  { type: "call", id, fn, args }
 *   worker → main  { type: "status", phase, detail, progress }
 *   worker → main  { type: "ready" }
 *   worker → main  { type: "boot-error", error }
 *   worker → main  { type: "result", id, ok: true, data }
 *   worker → main  { type: "result", id, ok: false, error }
 */

// Pyodide is loaded from our own origin (D1: no runtime CDN).
const PYODIDE_BASE = "/pyodide/";

// Canonical Python modules (served from public/py, synced from repo root).
const PY_MODULES = [
  "risk_engine.py",
  "real_data_loader.py",
  "data_loader.py",
  "brain.py",
  "core_api.py",
];

const DATA_FILES = ["real_bonds.csv", "treasury_snapshot.json"];

// Working dir inside Pyodide's FS. core_api/data_loader resolve data via
// os.path.dirname(__file__) + "/data", so modules and a sibling data/ dir
// must live together here.
const WORK_DIR = "/home/pyodide";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodide: any = null;
let bootPromise: Promise<void> | null = null;

type StatusPhase =
  | "downloading-runtime"
  | "loading-packages"
  | "loading-code"
  | "warming-up";

function postStatus(phase: StatusPhase, detail: string, progress: number) {
  (self as unknown as Worker).postMessage({
    type: "status",
    phase,
    detail,
    progress,
  });
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return res.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function boot(): Promise<void> {
  postStatus("downloading-runtime", "Loading Python runtime…", 0.05);

  // Self-hosted loader. pyodide.mjs is an ES module in the vendored release.
  const { loadPyodide } = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${PYODIDE_BASE}pyodide.mjs`
  );
  pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });

  postStatus("loading-packages", "Loading numpy, scipy, pandas…", 0.35);
  await pyodide.loadPackage(["numpy", "scipy", "pandas"]);

  postStatus("loading-code", "Loading optimizer…", 0.75);
  pyodide.FS.mkdirTree(WORK_DIR);
  pyodide.FS.mkdirTree(`${WORK_DIR}/data`);

  const [mods, data] = await Promise.all([
    Promise.all(PY_MODULES.map((m) => fetchText(`/py/${m}`))),
    Promise.all(DATA_FILES.map((f) => fetchBytes(`/data/${f}`))),
  ]);
  PY_MODULES.forEach((m, i) =>
    pyodide.FS.writeFile(`${WORK_DIR}/${m}`, mods[i]),
  );
  DATA_FILES.forEach((f, i) =>
    pyodide.FS.writeFile(`${WORK_DIR}/data/${f}`, data[i]),
  );

  await pyodide.runPythonAsync(`
import sys, json
sys.path.insert(0, "${WORK_DIR}")
import core_api

_NO_ARG = ("yield_curve", "stress_scenarios")
# Hard allowlist: only these core_api functions are callable from the main
# thread. Prevents an unexpected/typo'd fn name from resolving to an arbitrary
# module attribute via getattr.
_ALLOWED = {
    "yield_curve", "bonds", "optimize", "efficient_frontier",
    "monte_carlo", "stress_test", "backtest", "stress_scenarios",
}

def _dispatch(fn, args_json):
    if fn not in _ALLOWED:
        raise ValueError("unknown function: %r" % (fn,))
    func = getattr(core_api, fn)
    if fn in _NO_ARG:
        return json.dumps(func())
    params = json.loads(args_json) if args_json else {}
    return json.dumps(func(params))
`);

  postStatus("warming-up", "Warming up the solver…", 0.9);
  // Prewarm both default solves so the first user click is instant.
  await pyodide.runPythonAsync("core_api.prewarm()");

  postStatus("warming-up", "Ready", 1);
}

async function ensureBooted(): Promise<void> {
  if (!bootPromise) bootPromise = boot();
  return bootPromise;
}

// "bonds" takes a positional source; everything else takes a params dict or
// nothing. Normalize here so the Python dispatcher stays trivial.
function buildArgs(fn: string, args: unknown): Record<string, unknown> {
  if (fn === "bonds") {
    const a = (args ?? {}) as { source?: string };
    return { source: a.source ?? "real" };
  }
  if (fn === "yield_curve" || fn === "stress_scenarios") return {};
  return (args ?? {}) as Record<string, unknown>;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === "init") {
    try {
      await ensureBooted();
      (self as unknown as Worker).postMessage({ type: "ready" });
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: "boot-error",
        error: (err as Error).message || String(err),
      });
    }
    return;
  }

  if (msg.type === "call") {
    const { id, fn, args } = msg;
    try {
      await ensureBooted();
      const callArgs = buildArgs(fn, args);
      const needsArgs = fn !== "yield_curve" && fn !== "stress_scenarios";
      const argsJson = needsArgs ? JSON.stringify(callArgs) : "";
      // bonds() takes source positionally; pass it through the dict path.
      const py =
        fn === "bonds"
          ? `json.dumps(core_api.bonds(${JSON.stringify(
              callArgs.source ?? "real",
            )}))`
          : `_dispatch(${JSON.stringify(fn)}, ${JSON.stringify(argsJson)})`;
      const out = await pyodide.runPythonAsync(py);
      (self as unknown as Worker).postMessage({
        type: "result",
        id,
        ok: true,
        data: JSON.parse(out),
      });
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: "result",
        id,
        ok: false,
        error: (err as Error).message || String(err),
      });
    }
  }
};

export {};
