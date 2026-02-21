<p align="center">
  <h1 align="center">OptiMarket</h1>
  <p align="center">
    <strong>AI-Powered Bond Portfolio Optimization</strong><br>
    Nelson-Siegel Yield Curve Modeling · Covariance Risk Engine · SLSQP Non-Linear Programming
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white" alt="Python">
    <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
    <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/SciPy-8CAAE6?logo=scipy&logoColor=white" alt="SciPy">
    <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  </p>
</p>

---

## Overview

OptiMarket is a full-stack bond portfolio optimization platform that constructs mathematically optimal fixed-income portfolios. It integrates three core mathematical components:

1. **Nelson-Siegel Yield Curve** — Fits a parametric curve to live U.S. Treasury rates (Yahoo Finance) to price bonds at any maturity
2. **Covariance Risk Engine** — Builds an N×N correlation matrix capturing sector and credit-tier dependencies
3. **SLSQP Optimizer** — Solves constrained non-linear programming to maximize the Sharpe Ratio under real-world portfolio constraints

## Features

- 📈 **Live Yield Curve** — Real-time Treasury data fitted with Nelson-Siegel (β₀, β₁, β₂, λ)
- 🏦 **150 Synthetic Bonds** — 8 sectors, 7 credit tiers, 30 companies
- ⚡ **Dual Optimization** — Linear Programming (Maximize Yield) and SLSQP (Maximize Sharpe Ratio)
- 🎯 **Bond-Specific Constraints** — Duration matching, position limits, junk bond caps, sector diversification
- 📊 **Interactive Dashboard** — Donut charts, bar charts, trade sheet, efficient frontier
- 🎨 **Premium UI** — Dark-theme glassmorphism with Framer Motion animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python · FastAPI · SciPy · NumPy · Pandas |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS · Recharts · Framer Motion |
| **Data** | Yahoo Finance (yfinance) — Live U.S. Treasury Yields |
| **Optimization** | SciPy `linprog` (LP) · SciPy `minimize` SLSQP (NLP) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│  Landing Page · Dashboard · Charts · Trade Sheet        │
│                   (Port 3000)                           │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (JSON)
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                        │
│  /api/yield-curve · /api/bonds · /api/optimize          │
│  /api/efficient-frontier · /api/health                  │
│                   (Port 8000)                           │
└──────────────────────┬──────────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    ▼                  ▼                  ▼
 data_loader.py    brain.py          Yahoo Finance
 Nelson-Siegel     SLSQP Optimizer   Live Treasury
 Bond Generator    Covariance Matrix  Yields
```

## Mathematical Pipeline

### 1. Nelson-Siegel Yield Curve

```
y(τ) = β₀ + β₁·(1-e^(-λτ))/(λτ) + β₂·[(1-e^(-λτ))/(λτ) - e^(-λτ)]
```

Fits a continuous yield function to sparse Treasury data (3M, 5Y, 10Y, 30Y) using `scipy.optimize.curve_fit`.

### 2. Portfolio Risk Model

```
σ²_p = wᵀ · Σ · w
```

Covariance matrix Σ captures cross-correlations: high within same sector/rating, low across sectors.

### 3. Sharpe Ratio Optimization

```
maximize  (wᵀμ - Rf) / √(wᵀΣw)
subject to:
  Σwᵢ = 1              (full investment)
  wᵀD = D_target       (duration matching)
  0 ≤ wᵢ ≤ w_max       (position limits)
  Σ(junk) ≤ max_junk   (credit quality)
  Σ(sector) ≤ max_sec  (diversification)
```

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
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
python server.py

# Terminal 2: Start the frontend (port 3000)
cd frontend
npm run dev
```

Then open **http://localhost:3000** in your browser.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/yield-curve` | GET | Nelson-Siegel fitted yield curve + parameters |
| `/api/bonds` | GET | 150 synthetic bonds + market summary statistics |
| `/api/optimize` | POST | Run constrained optimization, returns portfolio + metrics |
| `/api/efficient-frontier` | POST | Generate efficient frontier data points |
| `/api/health` | GET | Health check |

## Sample Results

| Metric | Value |
|--------|-------|
| Portfolio Yield | 9.07% |
| Portfolio Duration | 5.00 years |
| Portfolio Volatility | 11.76% |
| Sharpe Ratio | 0.69 |
| Holdings | 8 bonds |

## Project Structure

```
opti-market/
├── server.py              # FastAPI backend (5 endpoints)
├── brain.py               # Optimization engine (linprog + SLSQP)
├── data_loader.py          # Nelson-Siegel fitting + bond generation
├── requirements.txt        # Python dependencies
├── presentation.html       # Project presentation (10 slides)
├── report.html             # Academic project report
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx           # Landing page
    │   │   ├── dashboard/
    │   │   │   └── page.tsx       # Dashboard + optimizer
    │   │   ├── globals.css        # Design system
    │   │   └── layout.tsx         # Root layout + SEO
    │   ├── components/
    │   │   └── Navbar.tsx         # Navigation bar
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

## License

This project is licensed under the MIT License.
