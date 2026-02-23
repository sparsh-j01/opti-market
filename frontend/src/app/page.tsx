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
    icon: "📈",
    title: "Smart Pricing",
    desc: "Automatically prices bonds using live US Treasury data, so you always work with up-to-date market rates.",
    accent: "#6c5ce7",
  },
  {
    icon: "🛡️",
    title: "Risk Analysis",
    desc: "Understands how different bonds move together — so your portfolio stays balanced across sectors and credit ratings.",
    accent: "#fd79a8",
  },
  {
    icon: "⚡",
    title: "One-Click Optimization",
    desc: "Finds the best combination of bonds that maximizes your returns while keeping risk under control — in seconds.",
    accent: "#00b894",
  },
];

const stats = [
  { value: "150", label: "Bonds Analyzed" },
  { value: "8", label: "Market Sectors" },
  { value: "<1s", label: "Optimization Time" },
  { value: "100%", label: "Constraint Compliant" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 radial-glow" />
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full opacity-30 animate-float"
          style={{ background: "radial-gradient(circle, rgba(108,92,231,0.15), transparent 70%)" }} />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(253,121,168,0.12), transparent 70%)", animation: "float 8s ease-in-out infinite reverse" }} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
              style={{ background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.15)", color: "var(--accent-primary)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-primary)" }} />
              AI-Powered Portfolio Optimization
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl font-black leading-tight mb-6 tracking-tight"
            style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}
          >
            Build the <span className="gradient-text">Perfect</span>
            <br />
            Bond Portfolio
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10"
            style={{ color: "var(--text-secondary)" }}
          >
            Set your investment goals, and let our optimizer find the best mix of bonds
            that maximizes your returns while managing risk — all in one click.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-full text-base font-bold text-white transition-all duration-300 hover:scale-105 animate-pulse-glow"
              style={{ background: "var(--gradient-main)" }}
            >
              Get Started →
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-full text-base font-medium transition-all duration-300"
              style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              How It Works
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex items-center justify-center gap-12 mt-16"
          >
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
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
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Why <span className="gradient-text">OptiMarket</span>?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg" style={{ color: "var(--text-secondary)" }}>
              Everything you need to make smarter bond investment decisions
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
                className="card-soft p-8 cursor-default"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5"
                  style={{ background: `${f.accent}10`, border: `1px solid ${f.accent}20` }}
                >
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 dot-pattern" style={{ background: "var(--bg-secondary)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              How It <span className="gradient-text">Works</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} style={{ color: "var(--text-secondary)" }}>
              Three simple steps to your ideal portfolio
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "1", title: "Set Your Goals", desc: "Tell us your budget, how long you want to invest, and how much risk you're comfortable with.", icon: "🎯" },
              { num: "2", title: "We Optimize", desc: "Our engine analyzes 150 bonds across 8 sectors and finds the best allocation for your goals.", icon: "🧠" },
              { num: "3", title: "See Results", desc: "Get a detailed breakdown with charts, allocation tables, and key performance metrics.", icon: "📊" },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="card-soft p-8 text-center"
              >
                <div className="text-4xl mb-4">{s.icon}</div>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white mb-4"
                  style={{ background: "var(--gradient-main)" }}>
                  {s.num}
                </div>
                <h4 className="text-lg font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.title}</h4>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.desc}</p>
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
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Ready to <span className="gradient-text">Invest Smarter</span>?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg mb-10" style={{ color: "var(--text-secondary)" }}>
            No complex formulas needed. Just set your preferences and let our optimizer do the work.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Link
              href="/dashboard"
              className="inline-block px-10 py-5 rounded-full text-lg font-bold text-white transition-all duration-300 hover:scale-105 animate-pulse-glow"
              style={{ background: "var(--gradient-main)" }}
            >
              Launch Dashboard →
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center" style={{ borderTop: "1px solid var(--border-color)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          OptiMarket — AI-Powered Bond Portfolio Optimization
        </p>
      </footer>
    </div>
  );
}
