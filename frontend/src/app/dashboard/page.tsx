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
    "#00d2ff", "#3a7bd5", "#7c3aed", "#ec4899", "#f59e0b",
    "#10b981", "#f43f5e", "#6366f1", "#8b5cf6", "#06b6d4",
    "#84cc16", "#ef4444", "#a855f7", "#14b8a6", "#f97316",
    "#e879f9", "#22d3ee", "#4ade80", "#fb7185", "#a78bfa"
];

const ALL_RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "D"];

function KPICard({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="rounded-xl p-5 text-center card-hover"
            style={{ background: "var(--gradient-card)", border: "1px solid var(--border-color)" }}
        >
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8888bb" }}>
                {label}
            </div>
            <div className="text-2xl font-bold gradient-text">{value}</div>
        </motion.div>
    );
}

export default function DashboardPage() {
    // State
    const [yieldData, setYieldData] = useState<YieldCurveData | null>(null);
    const [bondsData, setBondsData] = useState<BondsData | null>(null);
    const [results, setResults] = useState<OptimizeResult | null>(null);
    const [frontier, setFrontier] = useState<FrontierPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [showBonds, setShowBonds] = useState(false);

    // Constraints
    const [capital, setCapital] = useState(100000);
    const [targetDuration, setTargetDuration] = useState(5.0);
    const [maxAllocation, setMaxAllocation] = useState(20);
    const [objective, setObjective] = useState("Maximize Yield");
    const [riskFreeRate, setRiskFreeRate] = useState(0.01);
    const [maxJunk, setMaxJunk] = useState(30);
    const [maxSector, setMaxSector] = useState(25);
    const [junkRatings, setJunkRatings] = useState(["BB", "B", "CCC", "D"]);

    // Load initial data
    useEffect(() => {
        async function load() {
            try {
                const [yc, bonds] = await Promise.all([fetchYieldCurve(), fetchBonds()]);
                setYieldData(yc);
                setBondsData(bonds);
            } catch (e) {
                console.error("Failed to load data:", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleOptimize = useCallback(async () => {
        setOptimizing(true);
        setResults(null);
        setFrontier([]);
        try {
            const params = {
                target_duration: targetDuration,
                capital,
                max_allocation: maxAllocation / 100,
                objective_type: objective,
                risk_free_rate: riskFreeRate,
                max_junk_bond_allocation: maxJunk / 100,
                max_sector_allocation: maxSector / 100,
                junk_bond_ratings: junkRatings,
            };

            const res = await runOptimizer(params);
            setResults(res);

            // Fetch efficient frontier if Sharpe mode
            if (objective === "Optimize Sharpe Ratio" && res.success) {
                const { frontier: f } = await fetchEfficientFrontier({
                    capital,
                    max_allocation: maxAllocation / 100,
                    max_junk_bond_allocation: maxJunk / 100,
                    max_sector_allocation: maxSector / 100,
                    junk_bond_ratings: junkRatings,
                    risk_free_rate: riskFreeRate,
                });
                setFrontier(f);
            }
        } catch (e) {
            console.error("Optimization failed:", e);
        } finally {
            setOptimizing(false);
        }
    }, [targetDuration, capital, maxAllocation, objective, riskFreeRate, maxJunk, maxSector, junkRatings]);

    const toggleJunkRating = (rating: string) => {
        setJunkRatings(prev =>
            prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]
        );
    };

    // Prepare chart data
    const yieldCurveChartData = yieldData
        ? yieldData.curve.maturities.map((m, i) => ({
            maturity: m,
            yield: yieldData.curve.yields[i] * 100,
        }))
        : [];

    const dataPoints = yieldData
        ? yieldData.data_points.maturities.map((m, i) => ({
            maturity: m,
            yield: yieldData.data_points.rates[i] * 100,
        }))
        : [];

    const tabs = ["📊 Portfolio Overview", "📋 Trade Sheet", "📈 Advanced Analytics"];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 rounded-full"
                    style={{ border: "3px solid var(--border-color)", borderTopColor: "#00d2ff" }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-80 min-h-screen overflow-y-auto p-6 flex-shrink-0 fixed left-0 top-16 bottom-0 z-40"
                style={{
                    background: "linear-gradient(180deg, #0a0a1a 0%, #0d0d1a 100%)",
                    borderRight: "1px solid var(--border-color)",
                }}
            >
                <div className="mb-6">
                    <h2 className="text-lg font-bold gradient-text mb-1">⚡ OptiMarket Pro</h2>
                    <p className="text-xs" style={{ color: "#5558888" }}>Advanced Bond Portfolio Optimization</p>
                </div>
                <div style={{ borderTop: "1px solid var(--border-color)" }} className="mb-6" />

                {/* Objective */}
                <div className="mb-6">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-3" style={{ color: "#8888bb" }}>
                        🎯 Optimization Goal
                    </label>
                    {["Maximize Yield", "Optimize Sharpe Ratio"].map(opt => (
                        <button
                            key={opt}
                            onClick={() => setObjective(opt)}
                            className="w-full text-left px-4 py-3 rounded-lg mb-2 text-sm font-medium transition-all duration-200"
                            style={{
                                background: objective === opt ? "rgba(0,210,255,0.1)" : "transparent",
                                border: `1px solid ${objective === opt ? "rgba(0,210,255,0.3)" : "var(--border-color)"}`,
                                color: objective === opt ? "#00d2ff" : "#8888bb",
                            }}
                        >
                            {opt === "Maximize Yield" ? "📈 " : "⚖️ "}{opt}
                        </button>
                    ))}
                </div>

                {/* Capital */}
                <div className="mb-5">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "#8888bb" }}>
                        💰 Capital ($)
                    </label>
                    <input
                        type="number"
                        value={capital}
                        onChange={e => setCapital(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-lg text-sm font-medium outline-none transition-all focus:border-[#00d2ff]"
                        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    />
                </div>

                {/* Duration */}
                <div className="mb-5">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "#8888bb" }}>
                        Target Duration: <span className="gradient-text">{targetDuration.toFixed(1)} yrs</span>
                    </label>
                    <input
                        type="range" min="2" max="10" step="0.1"
                        value={targetDuration}
                        onChange={e => setTargetDuration(Number(e.target.value))}
                        className="w-full accent-[#00d2ff]"
                    />
                </div>

                {/* Max Allocation */}
                <div className="mb-5">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "#8888bb" }}>
                        Max per Bond: <span className="gradient-text">{maxAllocation}%</span>
                    </label>
                    <input
                        type="range" min="5" max="50" step="1"
                        value={maxAllocation}
                        onChange={e => setMaxAllocation(Number(e.target.value))}
                        className="w-full accent-[#00d2ff]"
                    />
                </div>

                {objective === "Optimize Sharpe Ratio" && (
                    <div className="mb-5">
                        <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "#8888bb" }}>
                            Risk-Free Rate
                        </label>
                        <input
                            type="number" step="0.001" value={riskFreeRate}
                            onChange={e => setRiskFreeRate(Number(e.target.value))}
                            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium outline-none transition-all focus:border-[#00d2ff]"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                        />
                    </div>
                )}

                <div style={{ borderTop: "1px solid var(--border-color)" }} className="my-5" />

                {/* Junk Ratings */}
                <div className="mb-5">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-3" style={{ color: "#8888bb" }}>
                        🛡️ Junk Bond Ratings
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_RATINGS.map(r => (
                            <button
                                key={r}
                                onClick={() => toggleJunkRating(r)}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                                style={{
                                    background: junkRatings.includes(r) ? "rgba(244,63,94,0.15)" : "var(--bg-card)",
                                    border: `1px solid ${junkRatings.includes(r) ? "rgba(244,63,94,0.4)" : "var(--border-color)"}`,
                                    color: junkRatings.includes(r) ? "#f43f5e" : "#8888bb",
                                }}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Max Junk */}
                <div className="mb-5">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "#8888bb" }}>
                        Max Junk: <span className="gradient-text">{maxJunk}%</span>
                    </label>
                    <input
                        type="range" min="0" max="100" step="5"
                        value={maxJunk}
                        onChange={e => setMaxJunk(Number(e.target.value))}
                        className="w-full accent-[#00d2ff]"
                    />
                </div>

                {/* Max Sector */}
                <div className="mb-5">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "#8888bb" }}>
                        Max per Sector: <span className="gradient-text">{maxSector}%</span>
                    </label>
                    <input
                        type="range" min="0" max="100" step="5"
                        value={maxSector}
                        onChange={e => setMaxSector(Number(e.target.value))}
                        className="w-full accent-[#00d2ff]"
                    />
                </div>

                <div style={{ borderTop: "1px solid var(--border-color)" }} className="my-5" />

                {/* Summary */}
                <div className="rounded-xl p-4 text-xs" style={{ background: "rgba(0,210,255,0.05)", border: "1px solid rgba(0,210,255,0.1)" }}>
                    <div className="font-semibold mb-2" style={{ color: "#00d2ff" }}>Current Settings</div>
                    <div className="space-y-1" style={{ color: "#8888bb" }}>
                        <div>Goal: {objective}</div>
                        <div>Duration: {targetDuration.toFixed(1)} yrs</div>
                        <div>Max/Bond: {maxAllocation}%</div>
                        <div>Max Junk: {maxJunk}%</div>
                        <div>Max/Sector: {maxSector}%</div>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 ml-80 p-8">
                {/* Yield Curve */}
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                        <span style={{ borderLeft: "3px solid #3a7bd5", paddingLeft: "10px" }}>📉 Live Treasury Yield Curve</span>
                    </h2>
                    <p className="text-xs mb-5" style={{ color: "#5558888" }}>
                        Nelson-Siegel parametric model fitted to live Yahoo Finance data
                    </p>

                    {yieldData && (
                        <>
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <KPICard label="β₀ (Level)" value={yieldData.ns_params.beta0.toFixed(4)} delay={0} />
                                <KPICard label="β₁ (Slope)" value={yieldData.ns_params.beta1.toFixed(4)} delay={0.1} />
                                <KPICard label="β₂ (Curve)" value={yieldData.ns_params.beta2.toFixed(4)} delay={0.2} />
                                <KPICard label="λ (Decay)" value={yieldData.ns_params.lambda.toFixed(4)} delay={0.3} />
                            </div>

                            <div className="rounded-2xl p-6 mb-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e4a" />
                                        <XAxis
                                            dataKey="maturity" type="number" domain={[0, 31]}
                                            tick={{ fill: "#8888bb", fontSize: 11 }} stroke="#2a2a5a"
                                            label={{ value: "Maturity (Years)", position: "bottom", fill: "#8888bb", fontSize: 12 }}
                                        />
                                        <YAxis
                                            tick={{ fill: "#8888bb", fontSize: 11 }} stroke="#2a2a5a"
                                            label={{ value: "Yield (%)", angle: -90, position: "insideLeft", fill: "#8888bb", fontSize: 12 }}
                                            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: "#111127", border: "1px solid #2a2a5a", borderRadius: "8px", color: "#e8e8ff" }}
                                            formatter={(val: unknown) => [`${Number(val).toFixed(2)}%`, "Yield"]}
                                            labelFormatter={(val: unknown) => `${Number(val).toFixed(1)} years`}
                                        />
                                        <Line data={yieldCurveChartData} dataKey="yield" stroke="#00d2ff" strokeWidth={2.5} dot={false} />
                                        <Line
                                            data={dataPoints} dataKey="yield" stroke="transparent" strokeWidth={0}
                                            dot={{ r: 6, fill: "#ff6b6b", stroke: "#ff6b6b" }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}
                </motion.section>

                {/* Bond Market */}
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                        <span style={{ borderLeft: "3px solid #3a7bd5", paddingLeft: "10px" }}>🏢 Synthetic Bond Market</span>
                    </h2>

                    {bondsData && (
                        <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <KPICard label="Total Bonds" value={String(bondsData.summary.total)} delay={0} />
                                <KPICard label="Avg Market Yield" value={`${(bondsData.summary.avg_yield * 100).toFixed(2)}%`} delay={0.1} />
                                <KPICard label="Sectors" value={String(bondsData.summary.sectors)} delay={0.2} />
                            </div>

                            <button
                                onClick={() => setShowBonds(!showBonds)}
                                className="mb-6 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:border-[#3a7bd5]"
                                style={{ border: "1px solid var(--border-color)", color: "#8888bb" }}
                            >
                                {showBonds ? "▾" : "▸"} View All {bondsData.summary.total} Bonds
                            </button>

                            <AnimatePresence>
                                {showBonds && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden mb-8"
                                    >
                                        <div className="rounded-2xl overflow-auto max-h-[400px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0" style={{ background: "var(--bg-secondary)" }}>
                                                    <tr>
                                                        {["Bond ID", "Company", "Sector", "Rating", "Yield", "Duration", "Volatility"].map(h => (
                                                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#8888bb", borderBottom: "1px solid var(--border-color)" }}>
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bondsData.bonds.map((b, i) => (
                                                        <tr key={i} className="transition-colors hover:bg-[#161640]" style={{ borderBottom: "1px solid #1e1e3a" }}>
                                                            <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "#00d2ff" }}>{b.Bond_ID}</td>
                                                            <td className="px-4 py-2.5">{b.Company}</td>
                                                            <td className="px-4 py-2.5" style={{ color: "#8888bb" }}>{b.Sector}</td>
                                                            <td className="px-4 py-2.5">
                                                                <span className="px-2 py-0.5 rounded text-xs font-bold"
                                                                    style={{
                                                                        background: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
                                                                        color: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "#10b981" : "#f43f5e"
                                                                    }}>
                                                                    {b.Rating}
                                                                </span>
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
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </motion.section>

                {/* Optimizer */}
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                        <span style={{ borderLeft: "3px solid #3a7bd5", paddingLeft: "10px" }}>🚀 Optimization Engine</span>
                    </h2>

                    <button
                        onClick={handleOptimize}
                        disabled={optimizing}
                        className="w-full py-4 rounded-xl text-base font-bold text-white transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed mb-8"
                        style={{ background: "linear-gradient(135deg, #3a7bd5, #00d2ff)" }}
                    >
                        {optimizing ? (
                            <span className="flex items-center justify-center gap-3">
                                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="inline-block w-5 h-5 rounded-full" style={{ border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                                Running Optimization...
                            </span>
                        ) : (
                            "⚡ RUN OPTIMIZER"
                        )}
                    </button>

                    {/* Results */}
                    <AnimatePresence>
                        {results && results.success && results.metrics && results.allocations && results.portfolio && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                {/* Success badge */}
                                <div className="rounded-xl px-4 py-3 mb-6 text-sm font-medium"
                                    style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                                    ✅ Optimization successful!
                                </div>

                                {/* KPIs */}
                                <div className="grid grid-cols-4 gap-4 mb-8">
                                    <KPICard label="Portfolio Yield" value={`${(results.metrics["Portfolio Yield"] * 100).toFixed(2)}%`} delay={0} />
                                    <KPICard label="Duration" value={`${results.metrics["Portfolio Duration"].toFixed(2)} yrs`} delay={0.1} />
                                    <KPICard label="Volatility" value={`${(results.metrics["Portfolio Volatility"] * 100).toFixed(2)}%`} delay={0.2} />
                                    <KPICard label="Sharpe Ratio" value={results.metrics["Sharpe Ratio"].toFixed(2)} delay={0.3} />
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-2 mb-6">
                                    {tabs.map((t, i) => (
                                        <button
                                            key={t}
                                            onClick={() => setActiveTab(i)}
                                            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                                            style={{
                                                background: activeTab === i ? "rgba(0,210,255,0.1)" : "transparent",
                                                border: `1px solid ${activeTab === i ? "rgba(0,210,255,0.3)" : "var(--border-color)"}`,
                                                color: activeTab === i ? "#00d2ff" : "#8888bb",
                                            }}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                {activeTab === 0 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-6">
                                        {/* Rating Donut */}
                                        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                            <h3 className="text-sm font-semibold mb-4" style={{ color: "#e8e8ff" }}>Allocation by Rating</h3>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <PieChart>
                                                    <Pie
                                                        data={results.allocations.by_rating}
                                                        dataKey="Allocation %"
                                                        nameKey="Rating"
                                                        cx="50%" cy="50%"
                                                        innerRadius={60} outerRadius={100}
                                                        paddingAngle={3}
                                                        label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${(value ?? 0).toFixed(1)}%`}
                                                        labelLine={{ stroke: "#8888bb" }}
                                                    >
                                                        {results.allocations.by_rating.map((_, i) => (
                                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ background: "#111127", border: "1px solid #2a2a5a", borderRadius: "8px", color: "#e8e8ff" }}
                                                        formatter={(val: unknown) => [`${Number(val).toFixed(1)}%`, "Allocation"]}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Sector Donut */}
                                        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                            <h3 className="text-sm font-semibold mb-4" style={{ color: "#e8e8ff" }}>Allocation by Sector</h3>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <PieChart>
                                                    <Pie
                                                        data={results.allocations.by_sector}
                                                        dataKey="Allocation %"
                                                        nameKey="Sector"
                                                        cx="50%" cy="50%"
                                                        innerRadius={60} outerRadius={100}
                                                        paddingAngle={3}
                                                        label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${(value ?? 0).toFixed(1)}%`}
                                                        labelLine={{ stroke: "#8888bb" }}
                                                    >
                                                        {results.allocations.by_sector.map((_, i) => (
                                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ background: "#111127", border: "1px solid #2a2a5a", borderRadius: "8px", color: "#e8e8ff" }}
                                                        formatter={(val: unknown) => [`${Number(val).toFixed(1)}%`, "Allocation"]}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 1 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="rounded-2xl overflow-auto max-h-[500px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0" style={{ background: "var(--bg-secondary)" }}>
                                                    <tr>
                                                        {["Bond ID", "Company", "Sector", "Rating", "Yield", "Duration", "Volatility", "Allocation %", "Investment ($)"].map(h => (
                                                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#8888bb", borderBottom: "1px solid var(--border-color)" }}>
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {results.portfolio.map((b, i) => (
                                                        <tr key={i} className="transition-colors hover:bg-[#161640]" style={{ borderBottom: "1px solid #1e1e3a" }}>
                                                            <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "#00d2ff" }}>{b.Bond_ID}</td>
                                                            <td className="px-4 py-2.5">{b.Company}</td>
                                                            <td className="px-4 py-2.5" style={{ color: "#8888bb" }}>{b.Sector}</td>
                                                            <td className="px-4 py-2.5">
                                                                <span className="px-2 py-0.5 rounded text-xs font-bold"
                                                                    style={{
                                                                        background: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
                                                                        color: ["AAA", "AA", "A", "BBB"].includes(b.Rating) ? "#10b981" : "#f43f5e"
                                                                    }}>
                                                                    {b.Rating}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 font-mono">{(b.Yield * 100).toFixed(2)}%</td>
                                                            <td className="px-4 py-2.5 font-mono">{b.Duration.toFixed(1)}</td>
                                                            <td className="px-4 py-2.5 font-mono">{(b.Volatility * 100).toFixed(2)}%</td>
                                                            <td className="px-4 py-2.5 font-mono font-bold" style={{ color: "#00d2ff" }}>{b["Allocation %"].toFixed(2)}%</td>
                                                            <td className="px-4 py-2.5 font-mono">${b["Investment ($)"].toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-xs mt-3" style={{ color: "#5558888" }}>
                                            Total capital deployed: ${results.portfolio.reduce((s, b) => s + b["Investment ($)"], 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} out of ${capital.toLocaleString()}
                                        </p>
                                    </motion.div>
                                )}

                                {activeTab === 2 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                        {/* Efficient Frontier */}
                                        {frontier.length > 0 && (
                                            <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                                <h3 className="text-sm font-semibold mb-2" style={{ color: "#e8e8ff" }}>The Efficient Frontier</h3>
                                                <p className="text-xs mb-4" style={{ color: "#5558888" }}>
                                                    Blue line = optimal portfolios at different risk levels. Red cross = your current portfolio.
                                                </p>
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <ScatterChart>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e4a" />
                                                        <XAxis
                                                            dataKey="Volatility" type="number"
                                                            tick={{ fill: "#8888bb", fontSize: 11 }} stroke="#2a2a5a"
                                                            tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                                                            label={{ value: "Portfolio Risk (Volatility σ)", position: "bottom", fill: "#8888bb", fontSize: 12 }}
                                                            domain={["auto", "auto"]}
                                                        />
                                                        <YAxis
                                                            dataKey="Yield" type="number"
                                                            tick={{ fill: "#8888bb", fontSize: 11 }} stroke="#2a2a5a"
                                                            tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                                                            label={{ value: "Return (Yield)", angle: -90, position: "insideLeft", fill: "#8888bb", fontSize: 12 }}
                                                            domain={["auto", "auto"]}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{ background: "#111127", border: "1px solid #2a2a5a", borderRadius: "8px", color: "#e8e8ff" }}
                                                            formatter={(val: unknown, name: unknown) => [
                                                                String(name) === "Yield" || String(name) === "Volatility"
                                                                    ? `${(Number(val) * 100).toFixed(2)}%`
                                                                    : Number(val).toFixed(2),
                                                                String(name)
                                                            ]}
                                                        />
                                                        <Scatter name="Frontier" data={frontier} fill="#3a7bd5" line={{ strokeWidth: 2 }} />
                                                        <Scatter
                                                            name="Your Portfolio"
                                                            data={[{
                                                                Volatility: results.metrics["Portfolio Volatility"],
                                                                Yield: results.metrics["Portfolio Yield"]
                                                            }]}
                                                            fill="#ff6b6b"
                                                            shape="cross"
                                                        />
                                                        <Legend />
                                                    </ScatterChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}

                                        {/* Company Allocation Bar */}
                                        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                            <h3 className="text-sm font-semibold mb-4" style={{ color: "#e8e8ff" }}>Allocation by Company</h3>
                                            <ResponsiveContainer width="100%" height={350}>
                                                <BarChart data={results.allocations.by_company} margin={{ bottom: 60 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e4a" />
                                                    <XAxis
                                                        dataKey="Company" tick={{ fill: "#8888bb", fontSize: 10 }} stroke="#2a2a5a"
                                                        angle={-45} textAnchor="end" interval={0}
                                                    />
                                                    <YAxis tick={{ fill: "#8888bb", fontSize: 11 }} stroke="#2a2a5a"
                                                        label={{ value: "Allocation (%)", angle: -90, position: "insideLeft", fill: "#8888bb", fontSize: 12 }}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ background: "#111127", border: "1px solid #2a2a5a", borderRadius: "8px", color: "#e8e8ff" }}
                                                        formatter={(val: unknown) => [`${Number(val).toFixed(1)}%`, "Allocation"]}
                                                    />
                                                    <Bar dataKey="Allocation %" radius={[4, 4, 0, 0]} fill="url(#barGradient)" />
                                                    <defs>
                                                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#00d2ff" />
                                                            <stop offset="100%" stopColor="#3a7bd5" />
                                                        </linearGradient>
                                                    </defs>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {results && !results.success && (
                        <div className="rounded-xl px-4 py-3 text-sm font-medium"
                            style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e" }}>
                            ❌ Optimization Failed: {results.error}. Try adjusting your constraints.
                        </div>
                    )}

                    {!results && !optimizing && (
                        <div className="text-center py-12" style={{ color: "#5558888" }}>
                            <p className="text-lg">👆 Set your constraints in the sidebar, then click <strong>RUN OPTIMIZER</strong></p>
                        </div>
                    )}
                </motion.section>
            </main>
        </div>
    );
}
