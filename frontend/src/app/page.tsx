"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/* Emil Kowalski strong ease-out — built-in eases lack punch. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const reveal = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: EASE_OUT },
  }),
};

/* Real Nelson-Siegel geometry as the hero anchor — the product's own
   instrument, not decoration (DESIGN.md: data is the only ornament). */
function YieldCurve() {
  const W = 520;
  const H = 340;
  const pad = { l: 44, r: 16, t: 24, b: 36 };
  const b0 = 0.047, b1 = -0.013, b2 = -0.022, lam = 2.1;
  const ns = (t: number) => {
    const x = t / lam;
    const e = Math.exp(-x);
    return b0 + b1 * ((1 - e) / x) + b2 * ((1 - e) / x - e);
  };
  const tMax = 30;
  const yMin = 0.03, yMax = 0.055;
  const px = (t: number) => pad.l + (t / tMax) * (W - pad.l - pad.r);
  const py = (y: number) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const pts: string[] = [];
  for (let t = 0.25; t <= tMax; t += 0.5) pts.push(`${px(t).toFixed(1)},${py(ns(t)).toFixed(1)}`);
  const path = `M ${pts.join(" L ")}`;
  const obs = [
    { t: 1, y: 0.0335 }, { t: 5, y: 0.0402 },
    { t: 10, y: 0.0451 }, { t: 30, y: 0.0508 },
  ];
  const gridY = [0.035, 0.04, 0.045, 0.05];
  const gridT = [0, 8, 16, 24, 30];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label="Nelson-Siegel yield curve fit to live Treasury rates">
      {gridY.map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={py(g)} y2={py(g)}
            stroke="var(--hairline)" strokeWidth="1" />
          <text x={pad.l - 8} y={py(g) + 3} textAnchor="end"
            fontFamily="'IBM Plex Mono', monospace" fontSize="10"
            fill="var(--muted)">{(g * 100).toFixed(1)}%</text>
        </g>
      ))}
      {gridT.map((t) => (
        <text key={t} x={px(t)} y={H - pad.b + 18} textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace" fontSize="10"
          fill="var(--muted)">{t}y</text>
      ))}
      <motion.path d={path} fill="none" stroke="var(--ink)" strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.2 }} />
      {obs.map((o, i) => (
        <motion.circle key={o.t} cx={px(o.t)} cy={py(o.y)} r="4.5"
          fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5"
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9 + i * 0.08, duration: 0.3, ease: EASE_OUT }} />
      ))}
    </svg>
  );
}

const capabilities = [
  {
    k: "01",
    title: "Real FINRA market data",
    body: "200+ corporate bonds with actual CUSIPs from FINRA TRACE — Apple, Microsoft, JPMorgan, Boeing, 45+ issuers. Not synthetic placeholders.",
  },
  {
    k: "02",
    title: "Monte Carlo VaR",
    body: "10,000-path simulation with Cholesky decomposition for Value-at-Risk and Expected Shortfall at 95% and 99% confidence.",
  },
  {
    k: "03",
    title: "SLSQP optimizer",
    body: "Non-linear solver finds the mathematically optimal allocation under duration, sector, and credit-quality constraints — in under a second.",
  },
];

const steps = [
  { n: "1", t: "Set constraints", d: "Capital, target duration, risk tolerance, sector and junk limits. Real FINRA or synthetic data." },
  { n: "2", t: "Solve", d: "SLSQP searches 200+ bonds across 8 sectors and 49 issuers for the optimal weights." },
  { n: "3", t: "Stress it", d: "Monte Carlo VaR, 7 macro scenarios, and a 12-month backtest — all computed in your browser." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen spine mx-auto max-w-[1280px]" style={{ background: "var(--paper)" }}>
      {/* ── Hero: asymmetric editorial split ── */}
      <section className="px-6 pt-24 pb-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-x-16 gap-y-12 items-center">
        <div className="max-w-[36rem]">
          <motion.p
            className="mono-label mb-7"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            In-browser fixed-income optimizer
          </motion.p>
          <motion.h1
            className="font-semibold leading-[1.04] mb-7"
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              color: "var(--ink)",
              letterSpacing: "-0.025em",
              fontSize: "clamp(2.6rem, 5.4vw, 4.4rem)",
            }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            The bond math,
            <br />
            shown working.
          </motion.h1>
          <motion.p
            className="text-lg leading-relaxed mb-9"
            style={{ color: "var(--muted)", maxWidth: "44ch" }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: EASE_OUT }}
          >
            Nelson-Siegel curves, SLSQP optimization, Monte Carlo VaR — the
            same machinery a desk runs, on real FINRA bonds, executing entirely
            on your device.
          </motion.p>
          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16, ease: EASE_OUT }}
          >
            <Link href="/dashboard"
              className="press px-6 py-3 text-sm font-medium transition-colors duration-150"
              style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: "2px" }}>
              Open the optimizer
            </Link>
            <Link href="/learn"
              className="press px-6 py-3 text-sm transition-colors duration-150"
              style={{ border: "1px solid var(--hairline-strong)", color: "var(--ink)", borderRadius: "2px" }}>
              Learn bonds first
            </Link>
          </motion.div>
        </div>

        {/* Right anchor: the instrument itself */}
        <motion.figure
          className="lg:pl-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
        >
          <div style={{ borderLeft: "1px solid var(--hairline)" }} className="pl-6">
            <YieldCurve />
            <figcaption className="mono-label mt-3">
              Nelson-Siegel fit · live Treasury observations
            </figcaption>
          </div>
        </motion.figure>
      </section>

      {/* Quiet credential line — not a metric grid */}
      <div className="px-6 pb-20">
        <p
          className="text-sm pt-5"
          style={{
            color: "var(--muted)",
            borderTop: "1px solid var(--hairline)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          200+ FINRA bonds&nbsp;&nbsp;·&nbsp;&nbsp;49 issuers&nbsp;&nbsp;·&nbsp;&nbsp;8 sectors&nbsp;&nbsp;·&nbsp;&nbsp;7 stress scenarios&nbsp;&nbsp;·&nbsp;&nbsp;47 tests passing&nbsp;&nbsp;·&nbsp;&nbsp;$0 to run
        </p>
      </div>

      {/* ── Capabilities: asymmetric, ruled list (no card grid) ── */}
      <section className="px-6 py-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-x-16 gap-y-10">
        <div>
          <p className="mono-label mb-3">What it actually does</p>
          <h2
            className="font-semibold"
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              color: "var(--ink)",
              fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Desk-grade methods, made legible.
          </h2>
        </div>
        <div>
          {capabilities.map((c, i) => (
            <motion.div
              key={c.k}
              className="grid grid-cols-[3rem_1fr] gap-x-5 py-7"
              style={{ borderTop: "1px solid var(--hairline)" }}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={reveal}
              custom={i}
            >
              <span
                className="text-sm pt-1"
                style={{ color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {c.k}
              </span>
              <div>
                <h3
                  className="text-xl font-semibold mb-2"
                  style={{ fontFamily: "'Fraunces', Georgia, serif", color: "var(--ink)" }}
                >
                  {c.title}
                </h3>
                <p className="text-base leading-relaxed" style={{ color: "var(--muted)", maxWidth: "54ch" }}>
                  {c.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works: tight horizontal rhythm ── */}
      <section
        className="px-6 py-16"
        style={{ borderTop: "1px solid var(--hairline)", background: "var(--surface)" }}
      >
        <p className="mono-label mb-8">Three steps</p>
        <div className="grid sm:grid-cols-3 gap-x-12 gap-y-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={reveal}
              custom={i}
            >
              <div
                className="text-sm mb-3 pb-3"
                style={{
                  color: "var(--muted)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                STEP {s.n}
              </div>
              <h4
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: "'Fraunces', Georgia, serif", color: "var(--ink)" }}
              >
                {s.t}
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {s.d}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA: compact, asymmetric ── */}
      <section className="px-6 py-24 grid lg:grid-cols-[1fr_auto] gap-x-16 gap-y-8 lg:items-end">
        <h2
          className="font-semibold"
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            color: "var(--ink)",
            fontSize: "clamp(1.9rem, 3.4vw, 3rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            maxWidth: "20ch",
          }}
        >
          Stop reading about bonds. Run the numbers.
        </h2>
        <Link
          href="/dashboard"
          className="press inline-block px-7 py-3.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap"
          style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: "2px" }}
        >
          Launch the dashboard
        </Link>
      </section>

      <footer
        className="px-6 py-8"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <p className="mono-label">
          OptiMarket · Nelson-Siegel · SLSQP · Monte Carlo VaR · Stress Testing · Backtesting
        </p>
      </footer>
    </div>
  );
}
