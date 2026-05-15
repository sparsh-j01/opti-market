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

```math
y(\tau) = \beta_0 + \beta_1 \cdot \frac{1 - e^{-\lambda \tau}}{\lambda \tau} + \beta_2 \cdot \left[ \frac{1 - e^{-\lambda \tau}}{\lambda \tau} - e^{-\lambda \tau} \right]
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

```math
\Sigma = \operatorname{diag}(\sigma) \cdot C \cdot \operatorname{diag}(\sigma)
```

where $C$ is the correlation matrix above and $\sigma$ is the per-bond
volatility vector.

[`data_loader.py:generate_covariance_matrix`](data_loader.py)

### Why this matters
This `Σ` is the input to portfolio volatility, the Sharpe optimization, and
the Cholesky decomposition for Monte Carlo. Get it wrong and every risk
number downstream is wrong.

---

## 3. Portfolio Volatility

```math
\sigma_p = \sqrt{w^{\top} \Sigma\, w}
```

$w$ is the vector of portfolio weights (must sum to 1), $\Sigma$ is the
covariance matrix from above. Note that this is *not* a weighted average of
individual volatilities — the cross-terms in $\Sigma$ mean that adding an
uncorrelated bond can *lower* portfolio volatility even if its own vol is
high. This is the diversification benefit.

[`brain.py:portfolio_volatility`](brain.py)

---

## 4. Sharpe Ratio Optimization

### The objective
Sharpe ratio is excess return per unit of risk:

```math
\text{Sharpe} = \frac{R_p - R_f}{\sigma_p}
```

We *maximize* it. SciPy's `minimize` only does minimization, so we minimize
the negative.

### The constrained program

```math
\max_w \quad \frac{w^{\top} \mu - R_f}{\sqrt{w^{\top} \Sigma\, w}}
```

```math
\begin{aligned}
\text{subject to} \quad
& \sum_i w_i = 1 && \text{(fully invested)} \\
& w^{\top} D = D_{\text{target}} && \text{(duration matching)} \\
& 0 \le w_i \le w_{\max} && \text{(no shorting, position cap)} \\
& \sum_{i \in \text{junk}} w_i \le \text{junk}_{\text{cap}} && \text{(HY exposure cap)} \\
& \sum_{i \in \text{sector}_k} w_i \le \text{sec}_{\text{cap}} && \forall\, k
\end{aligned}
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
($\Delta P / P \approx -D \cdot \Delta y$). Locking the portfolio's weighted-average duration to
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
1. **Cholesky decomposition.** Find $L$ such that $L \cdot L^{\top} = \Sigma$.
   Geometrically, $L$ is the "square root" of the covariance matrix.
2. **Generate i.i.d. standard normals.** $Z$ is an $N \times n_{\text{assets}}$
   matrix of independent draws from $\mathcal{N}(0, 1)$.
3. **Correlate them.** $R = Z \cdot L^{\top}$ — these rows now have the right
   covariance structure (you can verify: $\operatorname{Cov}(R) = \Sigma$).
4. **Compute portfolio returns** for each of the $N$ simulated paths:

   ```math
   r_{\text{path}} = \left( \mu_p - \tfrac{1}{2}\,\sigma_p^{2} \right) \cdot dt + (R \cdot w)\,\sqrt{dt}
   ```

   The $-\tfrac{1}{2}\sigma_p^{2}$ correction is the **Itô correction** — it
   appears because we're modeling log-returns under geometric Brownian motion.
5. **Terminal value:** $V = \text{capital} \cdot \exp(r_{\text{path}})$.
6. **Sort the P&Ls.** Pick quantiles.

### VaR (Value at Risk)
At confidence level $\alpha$ (e.g., 95%), VaR is the loss that's only exceeded
$(1 - \alpha)$ of the time:

```math
\text{VaR}_{\alpha} = -\,\mathrm{quantile}\bigl(\mathrm{PnL},\, 1 - \alpha\bigr)
```

"Across 10,000 simulated years, the 5th-percentile worst PnL was -$4,200,
so 95% VaR = $4,200." Read: there's a 5% chance you lose at least $4,200.

### CVaR (Conditional VaR / Expected Shortfall)
VaR has a known weakness: it tells you the *threshold*, but not how bad
things get *beyond* it. CVaR is the *average* loss conditional on being
worse than VaR:

```math
\text{CVaR}_{\alpha} = -\,\mathbb{E}\bigl[\mathrm{PnL} \mid \mathrm{PnL} \le -\text{VaR}_{\alpha}\bigr]
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

```math
y_{\text{new}} = y_{\text{base}} + \text{yield\_shift} + \bigl(\text{spread}_{\text{new}} - \text{spread}_{\text{base}}\bigr)
```

where $\text{spread}_{\text{new}} = \text{spread}_{\text{base}} \times \text{spread\_multiplier}$
(with separate multipliers for IG vs HY in the flight-to-quality scenario).

### The price impact
Using the **modified duration approximation** at the bond level:

```math
\frac{\Delta P_i}{P_i} \approx -D_i \cdot \Delta y_i
```

Portfolio-level — aggregate the per-bond impacts weighted by allocation:

```math
\frac{\Delta P_{\text{port}}}{P_{\text{port}}} = \sum_i w_i \cdot \bigl(-D_i \cdot \Delta y_i\bigr), \qquad \text{PnL} = \text{capital} \cdot \frac{\Delta P_{\text{port}}}{P_{\text{port}}}
```

**Why per-bond, not portfolio-average?** The simpler form
$-D_{\text{port}} \cdot \Delta y_{\text{weighted}}$ equals
$\bigl(\sum_i w_i D_i\bigr)\bigl(\sum_i w_i \Delta y_i\bigr)$, which only
matches $\sum_i w_i D_i \Delta y_i$ when durations and yield shifts are
uncorrelated across bonds. They're *not* in scenarios like flight-to-quality
(HY bonds get bigger $\Delta y$ *and* often have different durations than IG).
Per-bond aggregation is exact under any parallel or non-parallel shift.

This is still a first-order Taylor approximation — accurate for small
$\Delta y$, underestimates losses for large moves (because it ignores
convexity, $+\tfrac{1}{2} C\, \Delta y^{2}$). Acceptable for relative
scenario comparison, which is what stress tests are for.

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
2. **Equal-weight** — `wᵢ = 1/N` (naive benchmark).
3. **Risk-free** — earns `R_f` deterministically each period.

### Period return formula
For each period $t$ and asset shocks $R_t = Z_t \cdot L^{\top}$
(covariance $= \Sigma$):

```math
\begin{aligned}
r_{\text{opt}}(t) &= \mu_{\text{opt}} \cdot dt + \sqrt{dt}\,(R_t \cdot w_{\text{opt}}) \\
r_{\text{eq}}(t)  &= \mu_{\text{eq}}  \cdot dt + \sqrt{dt}\,(R_t \cdot w_{\text{eq}}) \\
V(t{+}1) &= V(t) \cdot \bigl(1 + r(t)\bigr)
\end{aligned}
```

Note: $R_t \cdot w$ is *already* a portfolio-level shock with std $\sigma_p$
(because $\operatorname{Var}(R w) = w^{\top} \Sigma\, w$). Scaling by
$\sqrt{dt}$ gives the correct per-period std $\sigma_p \sqrt{dt}$. **Do not**
multiply by $\sigma_p$ again — that would double-scale the volatility (this
was a real bug caught and fixed during the math audit; see
`risk_engine.py:run_backtest`).

The optimized and equal-weight portfolios share the same shock matrix `R`
each period — this is critical so the alpha comparison reflects *weight
choice*, not different luck.

### Reproducibility
Seeded with a **local** `np.random.default_rng(42)` so the same backtest run
is reproducible for demos and tests. The local RNG avoids polluting NumPy's
global random state — important because Monte Carlo *intentionally* uses
fresh draws each call (so VaR estimates aren't artificially deterministic
when a backtest happens to run first).

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

## 9. Math audit log

This codebase was line-audited against textbook formulas. Issues found
and corrected (kept here as a transparency record):

| Issue | Where | Fix |
|---|---|---|
| Backtest double-scaled volatility — multiplied period shock by `σ_p` even though the shock already had std `σ_p`. Effective per-period std became `σ_p² · √dt`. | `risk_engine.py:run_backtest` | Drop the `σ_p` multiplier; use `√dt · (R_t · w)` directly. |
| Stress test used `-D_portfolio · Δy_weighted` (only exact under uniform durations). | `risk_engine.py:run_stress_test` | Use `Σᵢ wᵢ · (-Dᵢ · Δyᵢ)`. |
| Risk-free rate hardcoded to `0.04` in stress and backtest while the optimizer used user-supplied `R_f`. | `risk_engine.py` + `server.py` | Thread `risk_free_rate` through both endpoints. |
| Backtest seeded the *global* NumPy RNG, leaking determinism into Monte Carlo if both endpoints were called in the same process. | `risk_engine.py:run_backtest` | Use a local `np.random.default_rng(42)`. |
| Request parameters had no upper bounds (`n_simulations`, `n_periods`, `capital`, etc.). | `server.py` | Pydantic `Field(ge=…, le=…)` on every field. |

All fixes are covered by the existing 47-test pytest suite (see
`tests/`).

---

## References

A complete citation list lives in the [README](README.md#references).
