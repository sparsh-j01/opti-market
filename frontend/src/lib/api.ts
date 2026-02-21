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
}

export async function fetchYieldCurve(): Promise<YieldCurveData> {
  const res = await fetch(`${API_BASE}/api/yield-curve`);
  if (!res.ok) throw new Error("Failed to fetch yield curve");
  return res.json();
}

export async function fetchBonds(): Promise<BondsData> {
  const res = await fetch(`${API_BASE}/api/bonds`);
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

export async function fetchEfficientFrontier(params: Omit<OptimizeParams, 'target_duration' | 'objective_type'>): Promise<{ frontier: FrontierPoint[] }> {
  const res = await fetch(`${API_BASE}/api/efficient-frontier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Frontier request failed");
  return res.json();
}
