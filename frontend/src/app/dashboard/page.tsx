"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, ScatterChart, Scatter,
    CartesianGrid, Legend
} from "recharts";
import {
    fetchYieldCurve, fetchBonds, runOptimizer, fetchEfficientFrontier,
    YieldCurveData, BondsData, OptimizeResult, FrontierPoint,
} from "@/lib/api";

const COLORS = [
    "#6c5ce7", "#a29bfe", "#fd79a8", "#fdcb6e", "#00b894",
    "#e17055", "#0984e3", "#00cec9", "#fab1a0", "#81ecec",
    "#74b9ff", "#dfe6e9", "#636e72", "#b2bec3", "#2d3436",
    "#ffeaa7", "#55efc4", "#ff7675", "#a29bfe", "#fd79a8"
];

const ALL_RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "D"];

function KPICard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl p-3 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="text-base font-bold gradient-text">{value}</div>
        </div>
    );
}

export default function DashboardPage() {
    const [yieldData, setYieldData] = useState<YieldCurveData | null>(null);
    const [bondsData, setBondsData] = useState<BondsData | null>(null);
    const [results, setResults] = useState<OptimizeResult | null>(null);
    const [frontier, setFrontier] = useState<FrontierPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [showBondsModal, setShowBondsModal] = useState(false);

    const [capital, setCapital] = useState(100000);
    const [targetDuration, setTargetDuration] = useState(5.0);
    const [maxAllocation, setMaxAllocation] = useState(20);
    const [objective, setObjective] = useState("Maximize Yield");
    const [riskFreeRate, setRiskFreeRate] = useState(0.01);
    const [maxJunk, setMaxJunk] = useState(30);
    const [maxSector, setMaxSector] = useState(25);
    const [junkRatings, setJunkRatings] = useState(["BB", "B", "CCC", "D"]);

    useEffect(() => {
        async function load() {
            try {
                const [yc, bonds] = await Promise.all([fetchYieldCurve(), fetchBonds()]);
                setYieldData(yc);
                setBondsData(bonds);
            } catch (e) { console.error("Failed to load data:", e); }
            finally { setLoading(false); }
        }
        load();
    }, []);

    const handleOptimize = useCallback(async () => {
        setOptimizing(true);
        setResults(null);
        setFrontier([]);
        setShowResultsModal(true);
        setActiveTab(0);
        try {
            const params = {
                target_duration: targetDuration, capital,
                max_allocation: maxAllocation / 100, objective_type: objective,
                risk_free_rate: riskFreeRate, max_junk_bond_allocation: maxJunk / 100,
                max_sector_allocation: maxSector / 100, junk_bond_ratings: junkRatings,
            };
            const res = await runOptimizer(params);
            setResults(res);
            if (objective === "Optimize Sharpe Ratio" && res.success) {
                const { frontier: f } = await fetchEfficientFrontier({
                    capital, max_allocation: maxAllocation / 100,
                    max_junk_bond_allocation: maxJunk / 100, max_sector_allocation: maxSector / 100,
                    junk_bond_ratings: junkRatings, risk_free_rate: riskFreeRate,
                });
                setFrontier(f);
            }
        } catch (e) { console.error("Optimization failed:", e); }
        finally { setOptimizing(false); }
    }, [targetDuration, capital, maxAllocation, objective, riskFreeRate, maxJunk, maxSector, junkRatings]);

    const toggleJunkRating = (rating: string) => {
        setJunkRatings(prev => prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]);
    };

    const yieldCurveChartData = yieldData
        ? yieldData.curve.maturities.map((m, i) => ({ maturity: m, yield: yieldData.curve.yields[i] * 100 }))
        : [];
    const dataPoints = yieldData
        ? yieldData.data_points.maturities.map((m, i) => ({ maturity: m, yield: yieldData.data_points.rates[i] * 100 }))
        : [];

    const tabs = ["📊 Overview", "📋 Trade Sheet", "📈 Analytics"];

    if (loading) {
        return (
            <div className="h-[calc(100vh-5rem)] flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
                <div className="text-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 rounded-full mx-auto mb-4"
                        style={{ border: "3px solid var(--border-color)", borderTopColor: "var(--accent-primary)" }} />
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading market data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-5rem)] flex overflow-hidden" style={{ background: "var(--bg-primary)" }}>
            {/* ===== SIDEBAR ===== */}
            <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-72 h-full overflow-y-auto p-5 flex-shrink-0 flex flex-col"
                style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border-color)" }}
            >
                <div className="mb-4">
                    <h2 className="text-base font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        ⚡ <span className="gradient-text">OptiMarket</span>
                    </h2>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Bond Portfolio Optimizer</p>
                </div>
                <div style={{ borderTop: "1px solid var(--border-color)" }} className="mb-4" />

                <div className="flex-1 space-y-3">
                    {/* Strategy */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-secondary)" }}>Strategy</label>
                        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                            {["Maximize Yield", "Optimize Sharpe Ratio"].map(opt => (
                                <button key={opt} onClick={() => setObjective(opt)}
                                    className="flex-1 py-2 text-xs font-medium transition-all duration-200"
                                    style={{
                                        background: objective === opt ? "var(--accent-primary)" : "transparent",
                                        color: objective === opt ? "#fff" : "var(--text-secondary)",
                                    }}>
                                    {opt === "Maximize Yield" ? "Max Yield" : "Sharpe Ratio"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Capital */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>Capital ($)</label>
                        <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg text-sm font-medium outline-none"
                            style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                    </div>

                    {/* Duration */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Duration</label>
                            <span className="text-xs font-bold gradient-text">{targetDuration.toFixed(1)} yrs</span>
                        </div>
                        <input type="range" min="2" max="10" step="0.1" value={targetDuration}
                            onChange={e => setTargetDuration(Number(e.target.value))} className="w-full" style={{ accentColor: "#6c5ce7" }} />
                    </div>

                    {/* Max per Bond */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Max per Bond</label>
                            <span className="text-xs font-bold gradient-text">{maxAllocation}%</span>
                        </div>
                        <input type="range" min="5" max="50" step="1" value={maxAllocation}
                            onChange={e => setMaxAllocation(Number(e.target.value))} className="w-full" style={{ accentColor: "#6c5ce7" }} />
                    </div>

                    {/* Risk-Free Rate (Sharpe only) */}
                    {objective === "Optimize Sharpe Ratio" && (
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>Risk-Free Rate</label>
                            <input type="number" step="0.001" value={riskFreeRate} onChange={e => setRiskFreeRate(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg text-sm font-medium outline-none"
                                style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        </div>
                    )}

                    <div style={{ borderTop: "1px solid var(--border-color)" }} className="!mt-4 !mb-1" />

                    {/* Junk Ratings */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-secondary)" }}>Junk Bond Ratings</label>
                        <div className="flex flex-wrap gap-1.5">
                            {ALL_RATINGS.map(r => (
                                <button key={r} onClick={() => toggleJunkRating(r)}
                                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
                                    style={{
                                        background: junkRatings.includes(r) ? "rgba(253,121,168,0.1)" : "var(--bg-primary)",
                                        border: `1px solid ${junkRatings.includes(r) ? "rgba(253,121,168,0.3)" : "var(--border-color)"}`,
                                        color: junkRatings.includes(r) ? "#fd79a8" : "var(--text-secondary)",
                                    }}>{r}</button>
                            ))}
                        </div>
                    </div>

                    {/* Max Junk */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Max Junk</label>
                            <span className="text-xs font-bold gradient-text">{maxJunk}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="5" value={maxJunk}
                            onChange={e => setMaxJunk(Number(e.target.value))} className="w-full" style={{ accentColor: "#6c5ce7" }} />
                    </div>

                    {/* Max Sector */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Max per Sector</label>
                            <span className="text-xs font-bold gradient-text">{maxSector}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="5" value={maxSector}
                            onChange={e => setMaxSector(Number(e.target.value))} className="w-full" style={{ accentColor: "#6c5ce7" }} />
                    </div>
                </div>

                {/* Bottom actions */}
                <div className="mt-4 space-y-2">
                    <button onClick={() => setShowBondsModal(true)}
                        className="w-full py-2.5 rounded-xl text-xs font-medium transition-all"
                        style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}>
                        🏢 View All Bonds
                    </button>
                    <button onClick={handleOptimize} disabled={optimizing}
                        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: "var(--gradient-main)", boxShadow: "0 4px 20px rgba(108,92,231,0.25)" }}>
                        ⚡ RUN OPTIMIZER
                    </button>
                </div>
            </motion.aside>

            {/* ===== MAIN CONTENT — Yield Curve ===== */}
            <main className="flex-1 h-full overflow-hidden p-6 flex flex-col">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-5 rounded-full" style={{ background: "var(--accent-primary)" }} />
                        <h2 className="text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>Live Treasury Yield Curve</h2>
                    </div>
                    {bondsData && (
                        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                            <span><strong className="gradient-text">{bondsData.summary.total}</strong> bonds</span>
                            <span>·</span>
                            <span><strong className="gradient-text">{bondsData.summary.sectors}</strong> sectors</span>
                            <span>·</span>
                            <span><strong className="gradient-text">{(bondsData.summary.avg_yield * 100).toFixed(1)}%</strong> avg yield</span>
                        </div>
                    )}
                </div>

                {/* NS Params */}
                {yieldData && (
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <KPICard label="β₀ (Level)" value={yieldData.ns_params.beta0.toFixed(4)} />
                        <KPICard label="β₁ (Slope)" value={yieldData.ns_params.beta1.toFixed(4)} />
                        <KPICard label="β₂ (Curvature)" value={yieldData.ns_params.beta2.toFixed(4)} />
                        <KPICard label="λ (Decay)" value={yieldData.ns_params.lambda.toFixed(4)} />
                    </div>
                )}

                {/* Yield Curve Chart */}
                {yieldData && (
                    <div className="flex-1 min-h-0 rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
                                <XAxis dataKey="maturity" type="number" domain={[0, 31]}
                                    tick={{ fill: "#6b6b80", fontSize: 11 }} stroke="#e2e2e8"
                                    tickFormatter={(v: number) => `${v}yr`} />
                                <YAxis tick={{ fill: "#6b6b80", fontSize: 11 }} stroke="#e2e2e8"
                                    tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                                <Tooltip
                                    contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "10px", color: "#1a1a2e", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                                    formatter={(val: unknown) => [`${Number(val).toFixed(2)}%`, "Yield"]}
                                    labelFormatter={(val: unknown) => `${Number(val).toFixed(1)} years`} />
                                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: 12 }} />
                                <Line data={yieldCurveChartData} dataKey="yield" stroke="#6c5ce7" strokeWidth={2.5} dot={false} name="Nelson-Siegel Curve" />
                                <Line data={dataPoints} dataKey="yield" stroke="transparent" strokeWidth={0} name="Live Treasury Rates"
                                    dot={{ r: 6, fill: "#fd79a8", stroke: "#fd79a8" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </main>

            {/* ========== BONDS MODAL ========== */}
            <AnimatePresence>
                {showBondsModal && bondsData && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-start justify-center pt-8 overflow-y-auto"
                        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
                        onClick={(e) => { if (e.target === e.currentTarget) setShowBondsModal(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 40, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="w-full max-w-5xl mx-4 mb-8 rounded-3xl overflow-hidden"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 24px 80px rgba(0,0,0,0.15)" }}
                        >
                            <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
                                <div>
                                    <h2 className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>🏢 Bond Market</h2>
                                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                                        {bondsData.summary.total} synthetic bonds · {bondsData.summary.sectors} sectors · Avg yield: {(bondsData.summary.avg_yield * 100).toFixed(2)}%
                                    </p>
                                </div>
                                <button onClick={() => setShowBondsModal(false)}
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110"
                                    style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>✕</button>
                            </div>
                            <div className="max-h-[70vh] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0" style={{ background: "var(--bg-secondary)" }}>
                                        <tr>
                                            {["Bond ID", "Company", "Sector", "Rating", "Yield", "Duration", "Volatility"].map(h => (
                                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                                                    style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bondsData.bonds.map((b, i) => (
                                            <tr key={i} className="transition-colors" style={{ borderBottom: "1px solid var(--border-color)" }}
                                                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--accent-primary)" }}>{b.Bond_ID}</td>
                                                <td className="px-4 py-2.5">{b.Company}</td>
                                                <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{b.Sector}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold"
                                                        style={{
                                                            background: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "rgba(0,184,148,0.1)" : "rgba(253,121,168,0.1)",
                                                            color: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "#00b894" : "#fd79a8"
                                                        }}>{b.Rating}</span>
                                                </td>
                                                <td className="px-4 py-2.5 font-mono">{(b.Yield * 100).toFixed(2)}%</td>
                                                <td className="px-4 py-2.5 font-mono">{b.Duration.toFixed(1)}</td>
                                                <td className="px-4 py-2.5 font-mono">{(b.Volatility * 100).toFixed(2)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========== RESULTS MODAL ========== */}
            <AnimatePresence>
                {showResultsModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-start justify-center pt-8 overflow-y-auto"
                        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
                        onClick={(e) => { if (e.target === e.currentTarget && !optimizing) setShowResultsModal(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 40, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="w-full max-w-5xl mx-4 mb-8 rounded-3xl overflow-hidden"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 24px 80px rgba(0,0,0,0.15)" }}
                        >
                            <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
                                <h2 className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>🎯 Optimization Results</h2>
                                {!optimizing && (
                                    <button onClick={() => setShowResultsModal(false)}
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110"
                                        style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>✕</button>
                                )}
                            </div>

                            <div className="p-8 max-h-[75vh] overflow-y-auto">
                                {optimizing && (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            className="w-14 h-14 rounded-full mb-6"
                                            style={{ border: "3px solid var(--border-color)", borderTopColor: "var(--accent-primary)" }} />
                                        <p className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>Running optimization...</p>
                                        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Analyzing 150 bonds across 8 sectors</p>
                                    </div>
                                )}

                                {results && !results.success && !optimizing && (
                                    <div className="rounded-2xl px-6 py-4 text-sm font-medium"
                                        style={{ background: "rgba(253,121,168,0.08)", border: "1px solid rgba(253,121,168,0.15)", color: "#fd79a8" }}>
                                        ❌ Optimization Failed: {results.error}. Try adjusting constraints.
                                    </div>
                                )}

                                {results && results.success && results.metrics && results.allocations && results.portfolio && !optimizing && (
                                    <>
                                        <div className="rounded-2xl px-4 py-3 mb-6 text-sm font-medium"
                                            style={{ background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.15)", color: "#00b894" }}>
                                            ✅ Optimization successful — {objective}
                                        </div>

                                        <div className="grid grid-cols-4 gap-4 mb-6">
                                            <KPICard label="Portfolio Yield" value={`${(results.metrics["Portfolio Yield"] * 100).toFixed(2)}%`} />
                                            <KPICard label="Duration" value={`${results.metrics["Portfolio Duration"].toFixed(2)} yrs`} />
                                            <KPICard label="Volatility" value={`${(results.metrics["Portfolio Volatility"] * 100).toFixed(2)}%`} />
                                            <KPICard label="Sharpe Ratio" value={results.metrics["Sharpe Ratio"].toFixed(2)} />
                                        </div>

                                        <div className="flex gap-2 mb-6">
                                            {tabs.map((t, i) => (
                                                <button key={t} onClick={() => setActiveTab(i)}
                                                    className="px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                                                    style={{
                                                        background: activeTab === i ? "rgba(108,92,231,0.08)" : "transparent",
                                                        border: `1px solid ${activeTab === i ? "rgba(108,92,231,0.25)" : "var(--border-color)"}`,
                                                        color: activeTab === i ? "var(--accent-primary)" : "var(--text-secondary)",
                                                    }}>{t}</button>
                                            ))}
                                        </div>

                                        {activeTab === 0 && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-6">
                                                <div className="rounded-2xl p-6" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                                    <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>By Rating</h3>
                                                    <ResponsiveContainer width="100%" height={280}>
                                                        <PieChart>
                                                            <Pie data={results.allocations.by_rating} dataKey="Allocation %" nameKey="Rating"
                                                                cx="50%" cy="45%" innerRadius={45} outerRadius={80} paddingAngle={3}
                                                                label={({ value }: { value?: number }) => `${(value ?? 0).toFixed(1)}%`}
                                                                labelLine={false}>
                                                                {results.allocations.by_rating.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                                                            </Pie>
                                                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "12px", color: "#1a1a2e" }}
                                                                formatter={(val: unknown) => [`${Number(val).toFixed(1)}%`, "Allocation"]} />
                                                            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="rounded-2xl p-6" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                                    <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>By Sector</h3>
                                                    <ResponsiveContainer width="100%" height={280}>
                                                        <PieChart>
                                                            <Pie data={results.allocations.by_sector} dataKey="Allocation %" nameKey="Sector"
                                                                cx="50%" cy="45%" innerRadius={45} outerRadius={80} paddingAngle={3}
                                                                label={({ value }: { value?: number }) => `${(value ?? 0).toFixed(1)}%`}
                                                                labelLine={false}>
                                                                {results.allocations.by_sector.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                                                            </Pie>
                                                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "12px", color: "#1a1a2e" }}
                                                                formatter={(val: unknown) => [`${Number(val).toFixed(1)}%`, "Allocation"]} />
                                                            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </motion.div>
                                        )}

                                        {activeTab === 1 && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                                <div className="rounded-2xl overflow-auto max-h-[400px]" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                                    <table className="w-full text-sm">
                                                        <thead className="sticky top-0" style={{ background: "var(--bg-secondary)" }}>
                                                            <tr>
                                                                {["Bond ID", "Company", "Sector", "Rating", "Yield", "Duration", "Vol.", "Alloc %", "Investment"].map(h => (
                                                                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider"
                                                                        style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {results.portfolio.map((b, i) => (
                                                                <tr key={i} className="transition-colors" style={{ borderBottom: "1px solid var(--border-color)" }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                                                    <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--accent-primary)" }}>{b.Bond_ID}</td>
                                                                    <td className="px-3 py-2">{b.Company}</td>
                                                                    <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{b.Sector}</td>
                                                                    <td className="px-3 py-2">
                                                                        <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                                                                            style={{
                                                                                background: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "rgba(0,184,148,0.1)" : "rgba(253,121,168,0.1)",
                                                                                color: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "#00b894" : "#fd79a8"
                                                                            }}>{b.Rating}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-mono">{(b.Yield * 100).toFixed(2)}%</td>
                                                                    <td className="px-3 py-2 font-mono">{b.Duration.toFixed(1)}</td>
                                                                    <td className="px-3 py-2 font-mono">{(b.Volatility * 100).toFixed(1)}%</td>
                                                                    <td className="px-3 py-2 font-mono font-bold" style={{ color: "var(--accent-primary)" }}>{b["Allocation %"].toFixed(2)}%</td>
                                                                    <td className="px-3 py-2 font-mono">${b["Investment ($)"].toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                                                    Deployed: ${results.portfolio.reduce((s, b) => s + b["Investment ($)"], 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} / ${capital.toLocaleString()}
                                                </p>
                                            </motion.div>
                                        )}

                                        {activeTab === 2 && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                                {frontier.length > 0 && (
                                                    <div className="rounded-2xl p-6" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                                        <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>Efficient Frontier</h3>
                                                        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Purple = optimal portfolios · Pink = yours</p>
                                                        <ResponsiveContainer width="100%" height={280}>
                                                            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" />
                                                                <XAxis dataKey="Volatility" type="number" tick={{ fill: "#6b6b80", fontSize: 11 }} stroke="#e2e2e8"
                                                                    tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                                                                    name="Risk" domain={["auto", "auto"]} />
                                                                <YAxis dataKey="Yield" type="number" tick={{ fill: "#6b6b80", fontSize: 11 }} stroke="#e2e2e8"
                                                                    tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                                                                    name="Return" domain={["auto", "auto"]} />
                                                                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "12px", color: "#1a1a2e" }}
                                                                    formatter={(val: unknown, name: unknown) => [
                                                                        String(name) === "Yield" || String(name) === "Volatility" ? `${(Number(val) * 100).toFixed(2)}%` : Number(val).toFixed(2), String(name)
                                                                    ]} />
                                                                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: 12 }} />
                                                                <Scatter name="Frontier" data={frontier} fill="#6c5ce7" line={{ strokeWidth: 2 }} />
                                                                <Scatter name="Your Portfolio"
                                                                    data={[{ Volatility: results.metrics["Portfolio Volatility"], Yield: results.metrics["Portfolio Yield"] }]}
                                                                    fill="#fd79a8" shape="cross" />
                                                            </ScatterChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                )}
                                                <div className="rounded-2xl p-6" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                                    <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Allocation by Company</h3>
                                                    <ResponsiveContainer width="100%" height={Math.max(250, results.allocations.by_company.length * 40)}>
                                                        <BarChart data={results.allocations.by_company} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e8" horizontal={false} />
                                                            <XAxis type="number" tick={{ fill: "#6b6b80", fontSize: 11 }} stroke="#e2e2e8"
                                                                tickFormatter={(v: number) => `${v}%`} />
                                                            <YAxis type="category" dataKey="Company" tick={{ fill: "#6b6b80", fontSize: 12 }} stroke="#e2e2e8" width={140} />
                                                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: "12px", color: "#1a1a2e" }}
                                                                formatter={(val: unknown) => [`${Number(val).toFixed(1)}%`, "Allocation"]} />
                                                            <Bar dataKey="Allocation %" radius={[0, 6, 6, 0]} fill="url(#barGM)" barSize={24} />
                                                            <defs>
                                                                <linearGradient id="barGM" x1="0" y1="0" x2="1" y2="0">
                                                                    <stop offset="0%" stopColor="#6c5ce7" /><stop offset="100%" stopColor="#a29bfe" />
                                                                </linearGradient>
                                                            </defs>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </motion.div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
