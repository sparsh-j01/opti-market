"use client";

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { MonteCarloResult, StressTestResult, BacktestResult } from "@/lib/api";

// Direct end-of-line label: renders the series name at its final point only,
// so overlapping lines are read at the line instead of via a legend.
// DESIGN.md: mono ink, no color (color = risk only).
const makeEndLabel = (text: string, fill: string, lastIdx: number) => {
    const EndLabel = (p: { x?: number | string; y?: number | string; index?: number }) => {
        if (p.index !== lastIdx) return null;
        return (
            <text x={(Number(p.x) || 0) + 8} y={Number(p.y) || 0} dy={3}
                fontFamily="'IBM Plex Mono', monospace" fontSize={10.5} fill={fill}>
                {text}
            </text>
        );
    };
    EndLabel.displayName = `EndLabel(${text})`;
    return EndLabel;
};

// ========== Monte Carlo Panel ==========
export function MonteCarloPanel({ data }: { data: MonteCarloResult }) {
    if (!data.success || !data.histogram || !data.var_cvar) return null;

    const var95 = data.var_cvar["95%"];
    const var99 = data.var_cvar["99%"];

    return (
        <div className="space-y-4">
            {/* VaR/CVaR KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "95% VaR", value: `$${var95?.VaR_dollar.toLocaleString()}`, sub: `${var95?.VaR_percent}%` },
                    { label: "95% CVaR", value: `$${var95?.CVaR_dollar.toLocaleString()}`, sub: `${var95?.CVaR_percent}%` },
                    { label: "99% VaR", value: `$${var99?.VaR_dollar.toLocaleString()}`, sub: `${var99?.VaR_percent}%` },
                    { label: "Prob of Loss", value: `${data.prob_loss}%`, sub: `${data.n_simulations?.toLocaleString()} sims` },
                ].map((k, i) => (
                    <div key={i} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                        <div className="mono-label mb-1">{k.label}</div>
                        <div className="text-sm font-mono" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{k.value}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Histogram */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>P&L Distribution</h3>
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{data.n_simulations?.toLocaleString()} Monte Carlo simulations · {data.time_horizon_days}-day horizon</p>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.histogram} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(23,20,15,0.14)" />
                        <XAxis dataKey="bin_mid" tick={{ fill: "#766f63", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} stroke="rgba(23,20,15,0.14)"
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis tick={{ fill: "#766f63", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} stroke="rgba(23,20,15,0.14)" />
                        <Tooltip contentStyle={{ background: "#fffcf4", border: "1px solid rgba(23,20,15,0.14)", borderRadius: "2px", color: "#17140f" }}
                            formatter={(val: unknown) => [Number(val), "Count"]}
                            labelFormatter={(v: unknown) => `P&L: $${Number(v).toLocaleString()}`} />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]} barSize={12}>
                            {data.histogram.map((entry, i) => (
                                <Cell key={i} fill={entry.bin_mid < 0 ? "#d84a1b" : "#17140f"} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Percentiles */}
            {data.percentiles && (
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-9 gap-2">
                    {Object.entries(data.percentiles).map(([k, v]) => (
                        <div key={k} className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                            <div className="mono-label">{k.toUpperCase()}</div>
                            <div className="text-xs font-mono" style={{ fontVariantNumeric: "tabular-nums", color: v < 0 ? "#d84a1b" : "#17140f" }}>${v.toLocaleString()}</div>
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
            <div className="rounded-2xl overflow-x-auto" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <table className="w-full text-sm min-w-[640px]">
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
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: s.yield_change_bp > 0 ? "#d84a1b" : "#17140f" }}>
                                    {s.yield_change_bp > 0 ? "+" : ""}{s.yield_change_bp}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: s.price_impact_pct < 0 ? "#d84a1b" : "#17140f" }}>
                                    {s.price_impact_pct > 0 ? "+" : ""}{s.price_impact_pct}%
                                </td>
                                <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: s.pnl_dollar < 0 ? "#d84a1b" : "#17140f" }}>
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
                <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>P&L Impact by Scenario</h3>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.scenarios} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(23,20,15,0.14)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#766f63", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} stroke="rgba(23,20,15,0.14)"
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#766f63", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} stroke="rgba(23,20,15,0.14)" width={120} />
                        <Tooltip contentStyle={{ background: "#fffcf4", border: "1px solid rgba(23,20,15,0.14)", borderRadius: "2px", color: "#17140f" }}
                            formatter={(val: unknown) => [`$${Number(val).toLocaleString()}`, "P&L"]} />
                        <Bar dataKey="pnl_dollar" radius={[0, 2, 2, 0]} barSize={18}>
                            {data.scenarios.map((s, i) => (
                                <Cell key={i} fill={s.pnl_dollar < 0 ? "#d84a1b" : "#17140f"} />
                            ))}
                        </Bar>
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

    // Direct end-of-line labels beat a legend when series overlap: you read
    // the name at the line, not by decoding a key. Renders only at the last
    // point. DESIGN.md: labels in mono ink, no color (color = risk only).
    const lastIdx = data.time_series.length - 1;
    const endLabel = (text: string, fill: string) => makeEndLabel(text, fill, lastIdx);

    return (
        <div className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: "Optimized", returnPct: s.optimized.total_return_pct, final: s.optimized.final_value, mdd: s.optimized.max_drawdown_pct, color: "#17140f" },
                    { label: "Equal Weight", returnPct: s.equal_weight.total_return_pct, final: s.equal_weight.final_value, mdd: s.equal_weight.max_drawdown_pct, color: "#17140f" },
                    { label: "Risk-Free", returnPct: s.risk_free.total_return_pct, final: s.risk_free.final_value, mdd: 0, color: "rgba(23,20,15,0.30)" },
                ].map((b, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                        </div>
                        <div className="text-lg font-mono" style={{ fontVariantNumeric: "tabular-nums", color: b.returnPct >= 0 ? "#17140f" : "#d84a1b" }}>
                            {b.returnPct >= 0 ? "+" : ""}{b.returnPct}%
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Final: ${b.final.toLocaleString()} · MDD: {b.mdd}%
                        </div>
                    </div>
                ))}
            </div>

            {/* Alpha badge */}
            <div className="flex flex-wrap gap-3">
                <div className="rounded-xl px-4 py-2 text-xs font-medium" style={{
                    background: s.alpha_vs_benchmark >= 0 ? "rgba(23,20,15,0.05)" : "rgba(216,74,27,0.08)",
                    border: `1px solid ${s.alpha_vs_benchmark >= 0 ? "rgba(23,20,15,0.14)" : "rgba(216,74,27,0.22)"}`,
                    color: s.alpha_vs_benchmark >= 0 ? "#17140f" : "#d84a1b",
                }}>
                    α vs Benchmark: {s.alpha_vs_benchmark >= 0 ? "+" : ""}{s.alpha_vs_benchmark}%
                </div>
                <div className="rounded-xl px-4 py-2 text-xs font-medium" style={{
                    background: s.alpha_vs_riskfree >= 0 ? "rgba(23,20,15,0.05)" : "rgba(216,74,27,0.08)",
                    border: `1px solid ${s.alpha_vs_riskfree >= 0 ? "rgba(23,20,15,0.14)" : "rgba(216,74,27,0.22)"}`,
                    color: s.alpha_vs_riskfree >= 0 ? "#17140f" : "#d84a1b",
                }}>
                    α vs Risk-Free: {s.alpha_vs_riskfree >= 0 ? "+" : ""}{s.alpha_vs_riskfree}%
                </div>
            </div>

            {/* Performance Chart */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                    Cumulative Performance ({data.n_periods} {data.period_type} periods)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.time_series} margin={{ top: 10, right: 92, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(23,20,15,0.14)" />
                        <XAxis dataKey="period" tick={{ fill: "#766f63", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} stroke="rgba(23,20,15,0.14)" />
                        <YAxis tick={{ fill: "#766f63", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} stroke="rgba(23,20,15,0.14)"
                            domain={['dataMin - 500', 'dataMax + 500']}
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
                        <Tooltip contentStyle={{ background: "#fffcf4", border: "1px solid rgba(23,20,15,0.14)", borderRadius: "2px", color: "#17140f" }}
                            formatter={(val: unknown, name: unknown) => [`$${Number(val).toLocaleString()}`, String(name)]} />
                        {/* Opacity-stepped ink separates the series (DESIGN.md
                            categorical method); Optimized is the hero — full ink,
                            solid. Direct end-labels replace the legend. */}
                        <Line dataKey="risk_free" stroke="rgba(23,20,15,0.26)" strokeWidth={1.5} dot={false}
                            name="Risk-Free" strokeDasharray="2 4" isAnimationActive={false}
                            label={endLabel("Risk-Free", "rgba(23,20,15,0.45)")} />
                        <Line dataKey="equal_weight" stroke="rgba(23,20,15,0.42)" strokeWidth={2} dot={false}
                            name="Equal Weight" strokeDasharray="5 4" isAnimationActive={false}
                            label={endLabel("Equal Weight", "rgba(23,20,15,0.62)")} />
                        <Line dataKey="optimized" stroke="#17140f" strokeWidth={2.5} dot={false}
                            name="Optimized" isAnimationActive={false}
                            label={endLabel("Optimized", "#17140f")} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
