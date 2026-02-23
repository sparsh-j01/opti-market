"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, LineChart, Line, Legend } from "recharts";
import { MonteCarloResult, StressTestResult, BacktestResult } from "@/lib/api";

// ========== Monte Carlo Panel ==========
export function MonteCarloPanel({ data }: { data: MonteCarloResult }) {
    if (!data.success || !data.histogram || !data.var_cvar) return null;

    const var95 = data.var_cvar["95%"];
    const var99 = data.var_cvar["99%"];

    return (
        <div className="space-y-4">
            {/* VaR/CVaR KPIs */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "95% VaR", value: `$${var95?.VaR_dollar.toLocaleString()}`, sub: `${var95?.VaR_percent}%` },
                    { label: "95% CVaR", value: `$${var95?.CVaR_dollar.toLocaleString()}`, sub: `${var95?.CVaR_percent}%` },
                    { label: "99% VaR", value: `$${var99?.VaR_dollar.toLocaleString()}`, sub: `${var99?.VaR_percent}%` },
                    { label: "Prob of Loss", value: `${data.prob_loss}%`, sub: `${data.n_simulations?.toLocaleString()} sims` },
                ].map((k, i) => (
                    <div key={i} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                        <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>{k.label}</div>
                        <div className="text-sm font-bold gradient-text">{k.value}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Histogram */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>P&L Distribution</h3>
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{data.n_simulations?.toLocaleString()} Monte Carlo simulations · {data.time_horizon_days}-day horizon</p>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.histogram} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
                        <XAxis dataKey="bin_mid" tick={{ fill: "#6b6b80", fontSize: 10 }} stroke="#e2e2e8"
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis tick={{ fill: "#6b6b80", fontSize: 10 }} stroke="#e2e2e8" />
                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "10px", color: "#1a1a2e" }}
                            formatter={(val: unknown) => [Number(val), "Count"]}
                            labelFormatter={(v: unknown) => `P&L: $${Number(v).toLocaleString()}`} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={12}>
                            {data.histogram.map((entry, i) => (
                                <rect key={i} fill={entry.bin_mid < 0 ? "#fd79a8" : "#6c5ce7"} />
                            ))}
                        </Bar>
                        <defs>
                            <linearGradient id="mcBar" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6c5ce7" /><stop offset="100%" stopColor="#a29bfe" />
                            </linearGradient>
                        </defs>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Percentiles */}
            {data.percentiles && (
                <div className="grid grid-cols-3 gap-2">
                    {Object.entries(data.percentiles).map(([k, v]) => (
                        <div key={k} className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                            <div className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>{k.toUpperCase()}</div>
                            <div className="text-xs font-bold" style={{ color: v < 0 ? "#fd79a8" : "#00b894" }}>${v.toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ========== Stress Test Panel ==========
export function StressTestPanel({ data }: { data: StressTestResult }) {
    if (!data.success || !data.scenarios) return null;

    return (
        <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <table className="w-full text-sm">
                    <thead style={{ background: "var(--bg-secondary)" }}>
                        <tr>
                            {["Scenario", "Yield Δ (bp)", "Price Impact", "P&L ($)", "Stressed Vol", "Sharpe"].map(h => (
                                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider"
                                    style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.scenarios.map((s, i) => (
                            <tr key={i} className="transition-colors" style={{ borderBottom: "1px solid var(--border-color)" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                <td className="px-3 py-2">
                                    <div className="font-medium text-xs">{s.name}</div>
                                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.description}</div>
                                </td>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: s.yield_change_bp > 0 ? "#fd79a8" : "#00b894" }}>
                                    {s.yield_change_bp > 0 ? "+" : ""}{s.yield_change_bp}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: s.price_impact_pct < 0 ? "#fd79a8" : "#00b894" }}>
                                    {s.price_impact_pct > 0 ? "+" : ""}{s.price_impact_pct}%
                                </td>
                                <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: s.pnl_dollar < 0 ? "#fd79a8" : "#00b894" }}>
                                    {s.pnl_dollar < 0 ? "-" : "+"}${Math.abs(s.pnl_dollar).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">{s.stressed_volatility}%</td>
                                <td className="px-3 py-2 font-mono text-xs">{s.stressed_sharpe.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* P&L Impact Bar Chart */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>P&L Impact by Scenario</h3>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.scenarios} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#6b6b80", fontSize: 10 }} stroke="#e2e2e8"
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#6b6b80", fontSize: 10 }} stroke="#e2e2e8" width={120} />
                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "10px", color: "#1a1a2e" }}
                            formatter={(val: unknown) => [`$${Number(val).toLocaleString()}`, "P&L"]} />
                        <Bar dataKey="pnl_dollar" radius={[0, 4, 4, 0]} barSize={18}
                            fill="#6c5ce7" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ========== Backtest Panel ==========
export function BacktestPanel({ data }: { data: BacktestResult }) {
    if (!data.success || !data.time_series || !data.summary) return null;

    const s = data.summary;

    return (
        <div className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Optimized", returnPct: s.optimized.total_return_pct, final: s.optimized.final_value, mdd: s.optimized.max_drawdown_pct, color: "#6c5ce7" },
                    { label: "Equal Weight", returnPct: s.equal_weight.total_return_pct, final: s.equal_weight.final_value, mdd: s.equal_weight.max_drawdown_pct, color: "#00b894" },
                    { label: "Risk-Free", returnPct: s.risk_free.total_return_pct, final: s.risk_free.final_value, mdd: 0, color: "#fdcb6e" },
                ].map((b, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                        </div>
                        <div className="text-lg font-bold" style={{ color: b.returnPct >= 0 ? "#00b894" : "#fd79a8" }}>
                            {b.returnPct >= 0 ? "+" : ""}{b.returnPct}%
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Final: ${b.final.toLocaleString()} · MDD: {b.mdd}%
                        </div>
                    </div>
                ))}
            </div>

            {/* Alpha badge */}
            <div className="flex gap-3">
                <div className="rounded-xl px-4 py-2 text-xs font-medium" style={{
                    background: s.alpha_vs_benchmark >= 0 ? "rgba(0,184,148,0.08)" : "rgba(253,121,168,0.08)",
                    border: `1px solid ${s.alpha_vs_benchmark >= 0 ? "rgba(0,184,148,0.2)" : "rgba(253,121,168,0.2)"}`,
                    color: s.alpha_vs_benchmark >= 0 ? "#00b894" : "#fd79a8",
                }}>
                    α vs Benchmark: {s.alpha_vs_benchmark >= 0 ? "+" : ""}{s.alpha_vs_benchmark}%
                </div>
                <div className="rounded-xl px-4 py-2 text-xs font-medium" style={{
                    background: s.alpha_vs_riskfree >= 0 ? "rgba(0,184,148,0.08)" : "rgba(253,121,168,0.08)",
                    border: `1px solid ${s.alpha_vs_riskfree >= 0 ? "rgba(0,184,148,0.2)" : "rgba(253,121,168,0.2)"}`,
                    color: s.alpha_vs_riskfree >= 0 ? "#00b894" : "#fd79a8",
                }}>
                    α vs Risk-Free: {s.alpha_vs_riskfree >= 0 ? "+" : ""}{s.alpha_vs_riskfree}%
                </div>
            </div>

            {/* Performance Chart */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Cumulative Performance ({data.n_periods} {data.period_type} periods)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.time_series} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
                        <XAxis dataKey="period" tick={{ fill: "#6b6b80", fontSize: 11 }} stroke="#e2e2e8" />
                        <YAxis tick={{ fill: "#6b6b80", fontSize: 11 }} stroke="#e2e2e8"
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "10px", color: "#1a1a2e" }}
                            formatter={(val: unknown) => [`$${Number(val).toLocaleString()}`, ""]} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: 12 }} />
                        <Line dataKey="optimized" stroke="#6c5ce7" strokeWidth={2.5} dot={false} name="Optimized" />
                        <Line dataKey="equal_weight" stroke="#00b894" strokeWidth={2} dot={false} name="Equal Weight" strokeDasharray="5 5" />
                        <Line dataKey="risk_free" stroke="#fdcb6e" strokeWidth={1.5} dot={false} name="Risk-Free" strokeDasharray="3 3" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
