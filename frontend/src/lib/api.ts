// Compute runs in the browser via a Pyodide Web Worker — there is no server.
// This module owns a singleton worker, a typed call() RPC, and the boot
// status stream the UI subscribes to. Public function signatures below are
// UNCHANGED so dashboard/components need no edits.

export type BootPhase =
  | "idle"
  | "downloading-runtime"
  | "loading-packages"
  | "loading-code"
  | "warming-up"
  | "ready"
  | "error";

export interface BootStatus {
  phase: BootPhase;
  detail: string;
  progress: number; // 0..1
  error?: string;
}

let worker: Worker | null = null;
let bootStatus: BootStatus = {
  phase: "idle",
  detail: "Initializing…",
  progress: 0,
};
const bootListeners = new Set<(s: BootStatus) => void>();
let nextCallId = 1;
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

function setBoot(s: BootStatus) {
  bootStatus = s;
  bootListeners.forEach((fn) => fn(s));
}

// Reject every in-flight call. Used when the worker can no longer produce
// results (boot failure, worker-level error) so callers never hang.
function rejectAllPending(err: Error) {
  pending.forEach((p) => p.reject(err));
  pending.clear();
}

export function getBootStatus(): BootStatus {
  return bootStatus;
}

export function subscribeBootStatus(fn: (s: BootStatus) => void): () => void {
  bootListeners.add(fn);
  fn(bootStatus);
  return () => bootListeners.delete(fn);
}

function spawnWorker(): Worker {
  const w = new Worker(
    new URL("../workers/optimize.worker.ts", import.meta.url),
    { type: "module" },
  );
  w.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === "status") {
      setBoot({ phase: m.phase, detail: m.detail, progress: m.progress });
    } else if (m.type === "ready") {
      setBoot({ phase: "ready", detail: "Ready", progress: 1 });
    } else if (m.type === "boot-error") {
      setBoot({
        phase: "error",
        detail: "Failed to start the in-browser engine.",
        progress: 0,
        error: m.error,
      });
      // Boot failed: any queued call() will never get a result. Reject them
      // so awaiting callers (e.g. dashboard load()) fail fast instead of
      // hanging forever behind the error overlay.
      rejectAllPending(new Error(m.error || "Engine failed to start"));
    } else if (m.type === "result") {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.ok) p.resolve(m.data);
      else p.reject(new Error(m.error || "Computation failed"));
    }
  };
  w.onerror = (e) => {
    setBoot({
      phase: "error",
      detail: "Failed to start the in-browser engine.",
      progress: 0,
      error: e.message,
    });
    rejectAllPending(new Error(e.message || "Worker error"));
  };
  return w;
}

function ensureWorker(): Worker {
  if (typeof window === "undefined") {
    throw new Error("Compute is only available in the browser.");
  }
  if (!worker) {
    worker = spawnWorker();
    worker.postMessage({ type: "init" });
  }
  return worker;
}

/** Kick off Pyodide boot eagerly (e.g. on dashboard mount). */
export function initEngine(): void {
  ensureWorker();
}

/** Retry after a boot failure: tear down and respawn the worker. */
export function retryEngine(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.forEach((p) => p.reject(new Error("Engine restarting")));
  pending.clear();
  setBoot({ phase: "idle", detail: "Restarting…", progress: 0 });
  ensureWorker();
}

function call<T>(fn: string, args?: unknown): Promise<T> {
  const w = ensureWorker();
  const id = nextCallId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
    });
    w.postMessage({ type: "call", id, fn, args });
  });
}

export interface YieldCurveData {
  ns_params: {
    beta0: number;
    beta1: number;
    beta2: number;
    lambda: number;
  };
  data_points: {
    maturities: number[];
    rates: number[];
  };
  curve: {
    maturities: number[];
    yields: number[];
  };
}

export interface Bond {
  Bond_ID: string;
  Company: string;
  Sector: string;
  Rating: string;
  Duration: number;
  Yield: number;
  Volatility: number;
  Price: number;
}

export interface BondsData {
  bonds: Bond[];
  summary: {
    total: number;
    avg_yield: number;
    sectors: number;
    ratings: string[];
  };
  data_source: string;
}

export interface PortfolioBond extends Bond {
  "Allocation %": number;
  "Investment ($)": number;
}

export interface AllocationItem {
  Rating?: string;
  Sector?: string;
  Company?: string;
  "Allocation %": number;
}

export interface OptimizeResult {
  success: boolean;
  portfolio?: PortfolioBond[];
  metrics?: {
    "Portfolio Yield": number;
    "Portfolio Duration": number;
    "Portfolio Volatility": number;
    "Sharpe Ratio": number;
  };
  allocations?: {
    by_rating: AllocationItem[];
    by_sector: AllocationItem[];
    by_company: AllocationItem[];
  };
  error?: string;
  data_source?: string;
}

export interface FrontierPoint {
  "Target Duration": number;
  Yield: number;
  Volatility: number;
  "Sharpe Ratio": number;
}

export interface OptimizeParams {
  target_duration: number;
  capital: number;
  max_allocation: number;
  objective_type: string;
  risk_free_rate: number;
  max_junk_bond_allocation: number;
  max_sector_allocation: number;
  junk_bond_ratings: string[];
  data_source?: string;
}

// Monte Carlo types
export interface VarCvarEntry {
  VaR_dollar: number;
  CVaR_dollar: number;
  VaR_percent: number;
  CVaR_percent: number;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  bin_mid: number;
  count: number;
  frequency: number;
}

export interface MonteCarloResult {
  success: boolean;
  n_simulations?: number;
  time_horizon_days?: number;
  capital?: number;
  expected_return_annual?: number;
  expected_volatility_annual?: number;
  mean_pnl?: number;
  median_pnl?: number;
  std_pnl?: number;
  min_pnl?: number;
  max_pnl?: number;
  prob_loss?: number;
  var_cvar?: Record<string, VarCvarEntry>;
  histogram?: HistogramBin[];
  percentiles?: Record<string, number>;
  error?: string;
}

// Stress Test types
export interface StressScenarioResult {
  scenario: string;
  name: string;
  description: string;
  base_yield: number;
  stressed_yield: number;
  yield_change_bp: number;
  price_impact_pct: number;
  pnl_dollar: number;
  base_volatility: number;
  stressed_volatility: number;
  base_sharpe: number;
  stressed_sharpe: number;
}

export interface StressTestResult {
  success: boolean;
  base_portfolio?: {
    yield: number;
    duration: number;
    volatility: number;
    sharpe: number;
    capital: number;
  };
  scenarios?: StressScenarioResult[];
  error?: string;
}

// Backtest types
export interface BacktestPoint {
  period: string;
  period_num: number;
  optimized: number;
  equal_weight: number;
  risk_free: number;
}

export interface BacktestResult {
  success: boolean;
  time_series?: BacktestPoint[];
  n_periods?: number;
  period_type?: string;
  summary?: {
    optimized: {
      total_return_pct: number;
      final_value: number;
      max_drawdown_pct: number;
      sharpe_ratio: number;
      portfolio_yield: number;
      portfolio_volatility: number;
    };
    equal_weight: {
      total_return_pct: number;
      final_value: number;
      max_drawdown_pct: number;
      sharpe_ratio: number;
      portfolio_yield: number;
      portfolio_volatility: number;
    };
    risk_free: {
      total_return_pct: number;
      final_value: number;
      rate: number;
    };
    alpha_vs_benchmark: number;
    alpha_vs_riskfree: number;
  };
  error?: string;
}

// API functions — same signatures as before; now routed to the Pyodide worker.

export async function fetchYieldCurve(): Promise<YieldCurveData> {
  return call<YieldCurveData>("yield_curve");
}

export async function fetchBonds(source: string = "real"): Promise<BondsData> {
  return call<BondsData>("bonds", { source });
}

export async function runOptimizer(params: OptimizeParams): Promise<OptimizeResult> {
  return call<OptimizeResult>("optimize", params);
}

export async function fetchEfficientFrontier(
  params: Omit<OptimizeParams, 'target_duration' | 'objective_type'>
): Promise<{ frontier: FrontierPoint[] }> {
  return call<{ frontier: FrontierPoint[] }>("efficient_frontier", params);
}

export async function runMonteCarlo(params: OptimizeParams & {
  n_simulations?: number;
  time_horizon_days?: number;
}): Promise<MonteCarloResult> {
  return call<MonteCarloResult>("monte_carlo", params);
}

export async function runStressTest(params: OptimizeParams & {
  scenarios?: string[];
}): Promise<StressTestResult> {
  return call<StressTestResult>("stress_test", params);
}

export async function runBacktest(params: OptimizeParams & {
  n_periods?: number;
  period_type?: string;
}): Promise<BacktestResult> {
  return call<BacktestResult>("backtest", params);
}

// Test seam for the Playwright keystone parity test. Harmless in production
// (just exposes the same public functions on window); the E2E suite calls
// runOptimizer here and asserts the numbers match the CPython golden.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__optimarket = {
    runOptimizer,
    fetchYieldCurve,
    getBootStatus,
    subscribeBootStatus,
    initEngine,
  };
}
