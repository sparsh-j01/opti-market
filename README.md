<p align="center">
  <h1 align="center">OptiMarket</h1>
  <p align="center">
    <strong>AI-Powered Bond Portfolio Optimization with Real Market Data</strong><br>
    Nelson-Siegel Yield Curve · Covariance Risk Engine · SLSQP Optimization · Monte Carlo VaR · Stress Testing
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white" alt="Python">
    <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
    <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/SciPy-8CAAE6?logo=scipy&logoColor=white" alt="SciPy">
    <img src="https://img.shields.io/badge/FINRA%20TRACE-Data-blue" alt="FINRA">
    <img src="https://img.shields.io/badge/FRED%20API-Yields-orange" alt="FRED">
    <img src="https://img.shields.io/badge/43%20Tests-Passing-brightgreen" alt="Tests">
    <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  </p>
</p>

---

## Overview

OptiMarket is a full-stack bond portfolio optimization platform that constructs mathematically optimal fixed-income portfolios using **real corporate bond data** from FINRA TRACE and live Treasury yields. It provides institutional-grade risk analytics including Monte Carlo VaR/CVaR, multi-scenario stress testing, and backtesting against benchmark portfolios.

> **No API keys required.** The system works out of the box with bundled market data and fallback rates. FRED API key is optional for live enrichment.

### Core Mathematical Components

1. **Nelson-Siegel Yield Curve** — Fits a parametric curve to live U.S. Treasury rates (Yahoo Finance / FRED API)
2. **Covariance Risk Engine** — Builds an N×N correlation matrix capturing sector and credit-tier dependencies
3. **SLSQP Optimizer** — Solves constrained non-linear programming to maximize the Sharpe Ratio
4. **Monte Carlo Simulator** — 10,000-path VaR/CVaR estimation using Cholesky-decomposed correlated returns
5. **Stress Testing Engine** — 7 pre-defined macro scenarios (rate shocks, credit crises, 2008 replay)
6. **Backtesting Framework** — Historical performance comparison vs. equal-weight and risk-free benchmarks

## Features

- 🏦 **Real Bond Data** — 200+ real corporate bonds with actual CUSIPs from FINRA TRACE (Apple, Microsoft, JPMorgan, etc.)
-  **Live Yield Curve** — Real-time Treasury data fitted with Nelson-Siegel (β₀, β₁, β₂, λ)
- **Dual Optimization** — Linear Programming (Maximize Yield) and SLSQP (Maximize Sharpe Ratio)
-  **Institutional Constraints** — Duration matching, position limits, junk bond caps, sector diversification
-  **Monte Carlo VaR** — 10,000-simulation P&L distribution with 90/95/99% VaR and CVaR
-  **Stress Testing** — 7 scenarios: Rate shocks (±100/200bp), credit crisis, flight-to-quality, stagflation, 2008 replay
-  **Backtesting** — Optimized vs. equal-weight vs. risk-free benchmark comparison
-  **Premium Dashboard** — Dark-theme glassmorphism with Framer Motion animations
- **43 Unit Tests** — Full test coverage for optimizer, data loader, and risk engine

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python · FastAPI · SciPy · NumPy · Pandas |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS · Recharts · Framer Motion |
| **Data** | FINRA TRACE (real bonds) · Yahoo Finance / FRED API (live Treasury yields) |
| **Optimization** | SciPy `linprog` (LP) · SciPy `minimize` SLSQP (NLP) |
| **Risk Analytics** | Monte Carlo (Cholesky) · Stress Testing · Backtesting |
| **Testing** | pytest (43 tests) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│  Landing Page · Dashboard · Monte Carlo · Stress Test   │
│  Backtest · Efficient Frontier · Trade Sheet            │
│                   (Port 3000)                           │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (JSON)
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                        │
│  /api/yield-curve · /api/bonds · /api/optimize          │
│  /api/efficient-frontier · /api/monte-carlo             │
│  /api/stress-test · /api/backtest                       │
│                   (Port 8000)                           │
└──────────────────────┬──────────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    ▼                  ▼                  ▼
 data_loader.py    brain.py          risk_engine.py
 Nelson-Siegel     SLSQP Optimizer   Monte Carlo VaR
 Real/Synthetic    Covariance Matrix  Stress Testing
 Bond Data         Efficient Frontier Backtesting
```

## Mathematical Pipeline

### 1. Nelson-Siegel Yield Curve

```
y(τ) = β₀ + β₁·(1-e^(-λτ))/(λτ) + β₂·[(1-e^(-λτ))/(λτ) - e^(-λτ)]
```

Fits a continuous yield function to sparse Treasury data using `scipy.optimize.curve_fit`.

### 2. Portfolio Risk Model

```
σ²_p = wᵀ · Σ · w
```

Covariance matrix Σ captures cross-correlations: high within same sector/rating, low across sectors.

### 3. Sharpe Ratio Optimization

```
maximize  (wᵀμ - Rf) / √(wᵀΣw)
subject to:  Σwᵢ = 1, wᵀD = D_target, 0 ≤ wᵢ ≤ w_max, Σ(junk) ≤ max_junk, Σ(sector) ≤ max_sec
```

### 4. Monte Carlo VaR/CVaR

```
L = cholesky(Σ)         # Decompose covariance matrix
Z ~ N(0, I)             # Generate random standard normals
R = Z · Lᵀ              # Correlated returns
VaR_α = -quantile(PnL, 1-α)    # Value at Risk
CVaR_α = -E[PnL | PnL ≤ -VaR]  # Conditional VaR (Expected Shortfall)
```

### 5. Stress Testing

Duration-based price sensitivity: `ΔP/P ≈ -D × Δy` applied under 7 macro scenarios with credit spread multipliers.

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+

### Installation

```bash
git clone https://github.com/sparsh-j01/opti-market.git
cd opti-market

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Running the Application

```bash
# Terminal 1: Start the backend (port 8000)
uvicorn server:app --port 8000 --reload

# Terminal 2: Start the frontend (port 3000)
# IMPORTANT: Run from the frontend/ directory, NOT the project root
cd frontend
npm run dev
```

Then open **http://localhost:3000** in your browser.

> **No API keys or environment variables required.** Everything works out of the box.

### Running Tests

```bash
python -m pytest tests/ -v
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/yield-curve` | GET | Nelson-Siegel fitted yield curve + parameters |
| `/api/bonds?source=real` | GET | 200+ real or 150 synthetic bond market data |
| `/api/optimize` | POST | Run constrained optimization, returns portfolio + metrics |
| `/api/efficient-frontier` | POST | Generate efficient frontier data points |
| `/api/monte-carlo` | POST | Monte Carlo VaR/CVaR simulation (10K paths) |
| `/api/stress-test` | POST | Run 7 stress scenarios on portfolio |
| `/api/backtest` | POST | Historical backtest vs. benchmarks |
| `/api/stress-scenarios` | GET | List available stress test scenarios |
| `/api/health` | GET | Health check |

## Project Structure

```
opti-market/
├── server.py              # FastAPI backend (9 endpoints)
├── brain.py               # Optimization engine (linprog + SLSQP)
├── data_loader.py         # Nelson-Siegel fitting + bond generation
├── real_data_loader.py    # FINRA TRACE + FRED API data loader
├── risk_engine.py         # Monte Carlo, stress testing, backtesting
├── requirements.txt       # Python dependencies
├── data/
│   └── real_bonds.csv     # 200+ real corporate bonds (CUSIPs)
├── tests/
│   ├── test_brain.py      # 16 optimization tests
│   ├── test_data_loader.py # 15 data loading tests
│   └── test_risk_engine.py # 12 risk analytics tests
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx           # Landing page
    │   │   ├── dashboard/
    │   │   │   └── page.tsx       # Dashboard (6 tabs)
    │   │   ├── globals.css        # Design system
    │   │   └── layout.tsx         # Root layout + SEO
    │   ├── components/
    │   │   ├── Navbar.tsx         # Navigation bar
    │   │   └── AnalyticsPanels.tsx # MC, Stress, Backtest panels
    │   └── lib/
    │       └── api.ts             # Typed API client
    ├── package.json
    └── tsconfig.json
```

## References

1. Markowitz, H. (1952). Portfolio Selection. *The Journal of Finance*, 7(1), 77–91.
2. Nelson, C. R., & Siegel, A. F. (1987). Parsimonious Modeling of Yield Curves. *The Journal of Business*, 60(4), 473–489.
3. Sharpe, W. F. (1966). Mutual Fund Performance. *The Journal of Business*, 39(1), 119–138.
4. Kraft, D. (1988). A software package for sequential quadratic programming. *DFVLR-FB 88-28*.
5. Jorion, P. (2006). *Value at Risk: The New Benchmark for Managing Financial Risk*. McGraw-Hill.

## License

This project is licensed under the MIT License.
