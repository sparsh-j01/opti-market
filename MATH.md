# OptiMarket — Mathematical Foundations

This document explains the math behind OptiMarket in plain English, along
with the formulas and references for each component. If you're reviewing
the code, this is the "why" — the README has the "what."

---

## 1. Nelson-Siegel Yield Curve

### The problem
The U.S. Treasury auctions bonds at a handful of fixed maturities (3-month,
2-year, 10-year, 30-year, etc.). But to price a corporate bond with a
duration of, say, 7.4 years, you need a yield at exactly 7.4 — not "between
the 5y and 10y points." You need a *continuous* yield curve.

### The model
Nelson & Siegel (1987) showed that real-world yield curves can be
approximated by three smooth components — a level, a slope, and a curvature
— controlled by four parameters. The formula:

```
y(τ) = β₀ + β₁ · (1 - e^(-λτ)) / (λτ) + β₂ · [(1 - e^(-λτ)) / (λτ) - e^(-λτ)]
```

| Parameter | Meaning |
|---|---|
| `β₀` | **Long-run level** — yield as τ → ∞ |
| `β₁` | **Short-end slope** — adds to yield at short maturities, decays toward zero |
| `β₂` | **Curvature/hump** — peaks at intermediate maturities |
| `λ` | **Decay rate** — controls *where* the slope and hump live on the curve |

### How we fit it
[`data_loader.py:fetch_real_treasury_rates`](data_loader.py) pulls four
points from yfinance (3-mo, 5y, 10y, 30y Treasury yields), then uses
`scipy.optimize.curve_fit` (a Levenberg-Marquardt nonlinear least-squares
solver) to find the `(β₀, β₁, β₂, λ)` that best fits those four points.

### Why this matters
Once fit, we can call `nelson_siegel(τ, ...)` for *any* maturity to get the
risk-free rate at that horizon. Every synthetic bond's base yield is set
this way — so the synthetic universe inherits the shape of today's actual
treasury curve, not some made-up flat 4%.

**Reference:** Nelson, C. R., & Siegel, A. F. (1987). *Parsimonious modeling
of yield curves.* Journal of Business, 60(4), 473–489.

---

## 2. Covariance Matrix Construction

### The problem
To estimate portfolio risk, you need to know how each pair of bonds moves
*together*. If two bonds always rally and crash in lockstep (correlation 1),
holding both gives you no diversification. If they're independent
(correlation 0), the portfolio's volatility is much lower than the sum of
the parts.

### The model
We don't have decades of return time series for these bonds, so we build
the covariance matrix structurally from credit-finance intuition:

| Relationship | Effect on correlation |
|---|---|
| Same sector | +0.30 |
| Same credit tier (both IG or both HY) | +0.15 |
| Baseline (any two bonds) | +0.25 |

Capped at 0.90 (no two bonds are *perfectly* correlated). Diagonal is 1.0.

The covariance is then:

```
Σ = diag(σ) · C · diag(σ)
```

where `C` is the correlation matrix above and `σ` is the per-bond
volatility vector.

[`data_loader.py:generate_covariance_matrix`](data_loader.py)

### Why this matters
This `Σ` is the input to portfolio volatility, the Sharpe optimization, and
the Cholesky decomposition for Monte Carlo. Get it wrong and every risk
number downstream is wrong.

---

## 3. Portfolio Volatility

```
σ_p = √(wᵀ · Σ · w)
```

`w` is the vector of portfolio weights (must sum to 1), `Σ` is the
covariance matrix from above. Note that this is *not* a weighted average of
individual volatilities — the cross-terms in `Σ` mean that adding an
uncorrelated bond can *lower* portfolio volatility even if its own vol is
high. This is the diversification benefit.

[`brain.py:portfolio_volatility`](brain.py)

---

## 4. Sharpe Ratio Optimization

### The objective
Sharpe ratio is excess return per unit of risk:

```
Sharpe = (Rₚ - R_f) / σ_p
```

We *maximize* it. SciPy's `minimize` only does minimization, so we minimize
the negative.

### The constrained program

```
maximize    (wᵀμ - R_f) / √(wᵀΣw)

subject to:
    Σ wᵢ = 1                        (fully invested)
    wᵀD = D_target                  (duration matching)
    0 ≤ wᵢ ≤ w_max                  (no shorting, position cap)
    Σ_{i ∈ junk} wᵢ ≤ junk_cap      (high-yield exposure cap)
    Σ_{i ∈ sector_k} wᵢ ≤ sec_cap   (per-sector cap, all k)
```

This is **non-linear** (the objective involves a square root over a
quadratic form) with **mixed equality and inequality constraints**.
The right tool is **SLSQP** — Sequential Least-Squares Programming, an
iterative quasi-Newton method that handles exactly this class of problem.

[`brain.py:run_solver`](brain.py) — see the `Optimize Sharpe Ratio` branch.

### The "Maximize Yield" alternative
When the objective is just yield (linear in `w`) and all constraints are
linear, the problem becomes a **linear program** — much faster, with a
guaranteed global optimum. We use `scipy.optimize.linprog` with the HiGHS
backend for that branch.

### Why duration matching matters
Bond duration measures price sensitivity to interest-rate changes
(`ΔP/P ≈ -D · Δy`). Locking the portfolio's weighted-average duration to
a target is how institutional investors immunize against rate moves at a
specific horizon (e.g., a pension fund matching a 10-year liability picks
`D_target = 10`).

**References:**
- Markowitz, H. (1952). *Portfolio Selection.* Journal of Finance, 7(1).
- Sharpe, W. F. (1966). *Mutual Fund Performance.* Journal of Business,
  39(1).
- Kraft, D. (1988). *A software package for sequential quadratic
  programming.* DFVLR-FB 88-28.

---

## 5. Monte Carlo VaR & CVaR

### The problem
The optimizer gives you *expected* return and *expected* volatility — point
estimates. They don't answer "what's the chance I lose more than $5,000
over the next year?" That's a tail-risk question, and you need the *full
distribution* of P&L outcomes, not just the mean and stddev.

### The simulation
1. **Cholesky decomposition.** Find `L` such that `L · Lᵀ = Σ`. Geometrically,
   `L` is the "square root" of the covariance matrix.
2. **Generate i.i.d. standard normals.** `Z` is an `N × n_assets` matrix of
   independent draws from N(0, 1).
3. **Correlate them.** `R = Z · Lᵀ` — these rows now have the right
   covariance structure (you can verify: `Cov(R) = Σ`).
4. **Compute portfolio returns** for each of the N simulated paths:

   ```
   r_path = (μ_p - 0.5·σ_p²)·dt + (R · w)·√dt
   ```

   The `-0.5·σ_p²` correction is the **Itô correction** — it appears
   because we're modeling log-returns under geometric Brownian motion.
5. **Terminal value:** `V = capital · exp(r_path)`.
6. **Sort the P&Ls.** Pick quantiles.

### VaR (Value at Risk)
At confidence level `α` (e.g., 95%), VaR is the loss that's only exceeded
`(1-α)` of the time:

```
VaR_α = -quantile(PnL, 1-α)
```

"Across 10,000 simulated years, the 5th-percentile worst PnL was -$4,200,
so 95% VaR = $4,200." Read: there's a 5% chance you lose at least $4,200.

### CVaR (Conditional VaR / Expected Shortfall)
VaR has a known weakness: it tells you the *threshold*, but not how bad
things get *beyond* it. CVaR is the *average* loss conditional on being
worse than VaR:

```
CVaR_α = -E[PnL | PnL ≤ -VaR_α]
```

By construction, **CVaR ≥ VaR always** — and that's verified in
[`tests/test_risk_engine.py`](tests/test_risk_engine.py)
(`test_cvar_geq_var`).

[`risk_engine.py:run_monte_carlo`](risk_engine.py)

**References:**
- Jorion, P. (2006). *Value at Risk: The New Benchmark for Managing
  Financial Risk.* McGraw-Hill.
- Rockafellar, R. T., & Uryasev, S. (2000). *Optimization of Conditional
  Value-at-Risk.* Journal of Risk, 2(3), 21–41.
- Glasserman, P. (2003). *Monte Carlo Methods in Financial Engineering.*
  Springer.

---

## 6. Stress Testing

### The problem
Monte Carlo assumes returns are normally distributed and that historical
covariance holds. Both assumptions break in a crisis. Stress tests are
*scenario-based*: "what would my portfolio do if rates spiked 200bp and
credit spreads widened 3x simultaneously?"

### The model
Each scenario specifies three shocks:
- `yield_shift` — parallel shift to all yields (e.g., +200bp)
- `spread_multiplier` — credit spreads scale by this factor
- `volatility_multiplier` — vols scale by this factor

For each bond, the stressed yield is:

```
y_new = y_base + yield_shift + (spread_new - spread_base)
```

Where `spread_new = spread_base × spread_multiplier` (with separate
multipliers for IG vs HY in the flight-to-quality scenario).

### The price impact
Using the **modified duration approximation**:

```
ΔP / P ≈ -D · Δy
```

Portfolio-level:

```
PnL = capital · (-D_portfolio · Δy_weighted)
```

This is a first-order Taylor approximation — accurate for small `Δy`,
underestimates losses for large moves (because it ignores convexity).
Acceptable for relative scenario comparison, which is what stress tests
are for.

### The 7 scenarios
| Scenario | Shift | Spread × | Vol × |
|---|---|---|---|
| Rate shock +200bp | +200 | 1.0 | 1.5 |
| Rate shock +100bp | +100 | 1.0 | 1.2 |
| Rate shock -100bp | -100 | 1.0 | 1.1 |
| Credit crisis | +50bp | 3.0 | 2.0 |
| Flight to quality | -150bp | 0.7 IG / 2.5 HY | 1.8 |
| Stagflation | +150bp | 1.8 | 1.6 |
| 2008 replay | -200bp | 5.0 | 3.0 |

[`risk_engine.py:run_stress_test`](risk_engine.py)

**Reference:** Fabozzi, F. J. (2007). *Fixed Income Analysis*, 2nd ed. CFA
Institute Investment Series, Wiley.

---

## 7. Backtesting

### The model
Generate `n_periods` (default 12 monthly) of correlated random shocks using
the same Cholesky decomposition as Monte Carlo. Apply identical shocks to
three portfolios:

1. **Optimized** — uses the SLSQP weights.
2. **Equal-weight** — `w_i = 1/N` (naive benchmark).
3. **Risk-free** — earns `R_f` deterministically each period.

### Reproducibility
Seeded with `np.random.seed(42)` so the same backtest run is reproducible
for demos and tests. **This is intentional and clearly documented in
code** — a real institutional backtest would use historical data, not
simulated paths. The synthetic backtest demonstrates the *engine*, not
*alpha*.

### Metrics computed per portfolio
- **Total return** — final value / capital - 1
- **Max drawdown** — worst peak-to-trough loss along the path
- **Sharpe ratio** — annualized excess return / annualized volatility
- **Alpha** — optimized return minus equal-weight return

[`risk_engine.py:run_backtest`](risk_engine.py)

---

## 8. What this project deliberately does NOT do

Honesty matters more than appearance. Things you might expect that aren't
here:

1. **Real historical bond return time series.** The covariance matrix is
   constructed structurally, not estimated from returns. Building a
   bond-return panel requires TRACE/Bloomberg subscriptions that aren't
   free.
2. **Convexity in stress tests.** We use a duration-only price model.
   Adding convexity (`ΔP/P ≈ -D·Δy + 0.5·C·Δy²`) would improve large-shock
   accuracy.
3. **Multi-factor risk model.** Real fixed-income desks decompose risk into
   level/slope/curvature factors plus credit and idiosyncratic components.
   This is single-factor (one parallel shift).
4. **Tax-lot accounting, callable bonds, embedded options.** Pure
   bullet-bond model.
5. **Live transaction execution.** This is a portfolio *construction*
   tool, not a trading platform.

These are clear next steps if you wanted to take this from "working
prototype" to "would survive a CFA exam committee."

---

## References

A complete citation list lives in the [README](README.md#references).
