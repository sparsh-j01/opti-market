const API_BASE = "http://localhost:8000";

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

// API functions

export async function fetchYieldCurve(): Promise<YieldCurveData> {
  const res = await fetch(`${API_BASE}/api/yield-curve`);
  if (!res.ok) throw new Error("Failed to fetch yield curve");
  return res.json();
}

export async function fetchBonds(source: string = "real"): Promise<BondsData> {
  const res = await fetch(`${API_BASE}/api/bonds?source=${source}`);
  if (!res.ok) throw new Error("Failed to fetch bonds");
  return res.json();
}

export async function runOptimizer(params: OptimizeParams): Promise<OptimizeResult> {
  const res = await fetch(`${API_BASE}/api/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Optimization request failed");
  return res.json();
}

export async function fetchEfficientFrontier(
  params: Omit<OptimizeParams, 'target_duration' | 'objective_type'>
): Promise<{ frontier: FrontierPoint[] }> {
  const res = await fetch(`${API_BASE}/api/efficient-frontier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Frontier request failed");
  return res.json();
}

export async function runMonteCarlo(params: OptimizeParams & {
  n_simulations?: number;
  time_horizon_days?: number;
}): Promise<MonteCarloResult> {
  const res = await fetch(`${API_BASE}/api/monte-carlo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Monte Carlo request failed");
  return res.json();
}

export async function runStressTest(params: OptimizeParams & {
  scenarios?: string[];
}): Promise<StressTestResult> {
  const res = await fetch(`${API_BASE}/api/stress-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Stress test request failed");
  return res.json();
}

export async function runBacktest(params: OptimizeParams & {
  n_periods?: number;
  period_type?: string;
}): Promise<BacktestResult> {
  const res = await fetch(`${API_BASE}/api/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Backtest request failed");
  return res.json();
}
