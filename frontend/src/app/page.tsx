"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const features = [
  {
    icon: "📉",
    title: "Nelson-Siegel Yield Curve",
    desc: "Fetches live US Treasury rates and fits a parametric model to create a smooth yield curve across all maturities — the foundation for bond pricing.",
    color: "#00d2ff",
  },
  {
    icon: "🔬",
    title: "Covariance Risk Engine",
    desc: "Constructs an N×N covariance matrix capturing inter-bond correlations. Portfolio risk is precisely calculated via matrix algebra: σ² = wᵀΣw.",
    color: "#3a7bd5",
  },
  {
    icon: "⚡",
    title: "SLSQP Non-Linear Optimizer",
    desc: "Searches millions of weight combinations to find the portfolio that maximizes return-per-unit-of-risk while respecting all your constraints.",
    color: "#7c3aed",
  },
];

const steps = [
  { num: "01", title: "Set Constraints", desc: "Define capital, target duration, maximum allocations, credit quality limits, and diversification rules." },
  { num: "02", title: "Generate Market", desc: "150 synthetic corporate bonds are generated using live Treasury yields + credit risk spreads." },
  { num: "03", title: "Optimize", desc: "The SLSQP solver finds the mathematically optimal portfolio in seconds." },
  { num: "04", title: "Analyze Results", desc: "View allocation charts, trade sheet, KPIs, and the efficient frontier." },
];

const formulas = [
  { label: "Nelson-Siegel", formula: "y(τ) = β₀ + β₁·[(1-e^(-λτ))/(λτ)] + β₂·[(1-e^(-λτ))/(λτ) - e^(-λτ)]" },
  { label: "Portfolio Volatility", formula: "σₚ = √(wᵀ · Σ · w)" },
  { label: "Sharpe Ratio", formula: "S = (Rₚ - Rf) / σₚ" },
  { label: "Covariance", formula: "Σ = diag(σ) · C · diag(σ)" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center grid-pattern overflow-hidden">
        <div className="absolute inset-0 radial-glow" />
        {/* Floating orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full opacity-20 animate-float"
          style={{ background: "radial-gradient(circle, rgba(0,210,255,0.3), transparent 70%)" }} />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.3), transparent 70%)", animation: "float 8s ease-in-out infinite reverse" }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
              style={{ background: "rgba(0,210,255,0.1)", border: "1px solid rgba(0,210,255,0.2)", color: "#00d2ff" }}>
              <span className="w-2 h-2 rounded-full bg-[#00d2ff] animate-pulse" />
              Powered by SciPy Non-Linear Optimization
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-7xl font-black leading-tight mb-6 tracking-tight"
          >
            <span className="gradient-text">AI-Powered</span>
            <br />
            Bond Portfolio
            <br />
            <span style={{ color: "#8888bb" }}>Optimization</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10"
            style={{ color: "#8888bb" }}
          >
            Build mathematically optimal bond portfolios using Nelson-Siegel yield curve modeling,
            covariance-based risk analysis, and SLSQP constrained optimization — all in one click.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-xl text-base font-bold text-white transition-all duration-300 hover:scale-105 animate-pulse-glow"
              style={{ background: "linear-gradient(135deg, #3a7bd5, #00d2ff)" }}
            >
              Go to Dashboard →
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-xl text-base font-medium transition-all duration-300 hover:border-[#3a7bd5]"
              style={{ border: "1px solid #2a2a5a", color: "#8888bb" }}
            >
              Learn More
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex items-center justify-center gap-12 mt-16"
          >
            {[
              { value: "150", label: "Bonds Simulated" },
              { value: "8", label: "Market Sectors" },
              { value: "4", label: "Constraints" },
              { value: "<1s", label: "Optimization" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs mt-1" style={{ color: "#5558888" }}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl font-bold mb-4">
              The <span className="gradient-text">3-Step Pipeline</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg" style={{ color: "#8888bb" }}>
              From live market data to optimal portfolio in seconds
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 2}
                className="rounded-2xl p-8 card-hover cursor-default"
                style={{
                  background: "var(--gradient-card)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-5"
                  style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}
                >
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#8888bb" }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6" style={{ background: "var(--bg-secondary)" }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl font-bold mb-4">
              How It <span className="gradient-text">Works</span>
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="relative rounded-2xl p-6 card-hover"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              >
                <div
                  className="text-3xl font-black mb-4"
                  style={{ color: "rgba(0,210,255,0.2)" }}
                >
                  {s.num}
                </div>
                <h4 className="text-lg font-bold mb-2">{s.title}</h4>
                <p className="text-sm" style={{ color: "#8888bb" }}>{s.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 text-[#2a2a5a] text-2xl">
                    →
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Math Showcase */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl font-bold mb-4">
              The <span className="gradient-text">Mathematics</span> Behind It
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} style={{ color: "#8888bb" }}>
              Research-grade quantitative finance, made interactive
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formulas.map((f, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="rounded-xl p-6 card-hover"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#00d2ff" }}>
                  {f.label}
                </div>
                <div className="font-mono text-sm" style={{ color: "#a0a0d0" }}>
                  {f.formula}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-bold mb-6">
            Ready to <span className="gradient-text">Optimize</span>?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg mb-10" style={{ color: "#8888bb" }}>
            Set your constraints, click a button, and let the math do the rest.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Link
              href="/dashboard"
              className="inline-block px-10 py-5 rounded-xl text-lg font-bold text-white transition-all duration-300 hover:scale-105 animate-pulse-glow"
              style={{ background: "linear-gradient(135deg, #3a7bd5, #00d2ff)" }}
            >
              Launch Dashboard →
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center" style={{ borderTop: "1px solid var(--border-color)" }}>
        <p className="text-sm" style={{ color: "#5558888" }}>
          OptiMarket — AI-Powered Bond Portfolio Optimization Engine
        </p>
      </footer>
    </div>
  );
}
