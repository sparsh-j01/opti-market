"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    }),
};

interface Term {
    term: string;
    icon: string;
    category: string;
    oneLiner: string;
    explanation: string;
    example: string;
    inProject: string;
}

const terms: Term[] = [
    {
        term: "Bond",
        icon: "B",
        category: "Basics",
        oneLiner: "An IOU. You lend money, get regular interest, and your money back later.",
        explanation: "Your friend Ravi needs money for his business. He says 'Give me one lakh, I'll pay you five thousand every year, and return your one lakh after 5 years.' That deal is a bond. Now replace Ravi with Apple or JPMorgan — same deal, just way bigger numbers and written on fancy legal paper.",
        example: "Apple borrows $100 from you. They pay you $4.15 every single year for 5 years. After those 5 years, you get your $100 back. That $4.15/year is your reward for letting Apple use your money.",
        inProject: "Our app has 200+ real bonds from companies like Apple, Microsoft, Boeing, Ford, and Goldman Sachs stored in real_bonds.csv.",
    },
    {
        term: "Yield",
        icon: "Y",
        category: "Basics",
        oneLiner: "Your actual annual return if you buy a bond today at today's market price.",
        explanation: "You lent Ravi one lakh and he pays you five thousand a year. That's a 5% yield. But what if Ravi's business is shaky and nobody trusts him? You might buy his bond for only eighty thousand but he still pays five thousand a year. Now your yield is 5,000 / 80,000 = 6.25%. The price went down, so the yield went up — they always move in opposite directions, like a seesaw.",
        example: "A bond pays $5/year. If it costs $100, your yield is 5%. If the market panics and the price drops to $80, your yield jumps to 6.25% — same $5 payment, cheaper entry price.",
        inProject: "Every bond in our dataset has a yield. The optimizer tries to build a portfolio with the highest combined yield for the risk taken.",
    },
    {
        term: "Coupon",
        icon: "C",
        category: "Basics",
        oneLiner: "The fixed interest payment stamped on the bond forever. It never changes.",
        explanation: "When Apple first created the bond, they said 'We'll pay 3.85% every year.' That number is carved in stone — no matter what happens to the economy, Apple stock, or anything else, they'll pay that exact 3.85% on the face value. The coupon is the deal you signed up for. Yield bounces around daily because market prices change, but coupon stays exactly the same for life.",
        example: "Apple's bond has a 3.85% coupon on a $100 face value. That means $3.85 per year, every year, guaranteed. Whether the bond trades at $90 or $110 in the market, you still get $3.85.",
        inProject: "You can see each bond's coupon rate in the real_bonds.csv data file. It's one of the columns alongside yield and duration.",
    },
    {
        term: "Maturity",
        icon: "M",
        category: "Basics",
        oneLiner: "When the company gives you your original money back. The expiry date.",
        explanation: "If Apple says their bond matures in 10 years, that means for 10 years they pay you interest, and on day one of year 11, they hand you back your principal — the original money you lent them. After that, the bond ceases to exist. Longer maturity usually means higher interest because you're locking your money away for longer and that should cost the borrower more.",
        example: "A bond maturing in 5.2 years means Apple returns your $100 in about 5 years and 2 months from today. Until then, you collect your coupon payments.",
        inProject: "Our bonds range from about 2 years to over 25 years. The duration slider on the dashboard lets you target a specific maturity profile.",
    },
    {
        term: "Duration",
        icon: "D",
        category: "Risk",
        oneLiner: "How badly your bond's price drops when interest rates go up by 1%.",
        explanation: "Think of it like sunburn risk. If you're outside for 2 hours, you get a little pink. If you're outside for 15 hours, you're toast. Duration works the same way — it tells you how 'exposed' your bond is to interest rate changes. A duration of 5 means if the central bank raises rates by 1%, your bond price drops roughly 5%. Higher duration equals more sensitivity, which means more risk.",
        example: "Your bond has duration 5.0. The Fed raises rates by 1%. Your bond, which was worth $100, is now worth about $95. If duration was 2.0, it would only drop to $98.",
        inProject: "The optimizer lets you set a target duration (like 5 years) and guarantees the final portfolio matches it. This is the 'DURATION' slider in the sidebar.",
    },
    {
        term: "CUSIP",
        icon: "ID",
        category: "Basics",
        oneLiner: "A 9-character ID number uniquely identifying every bond in the US.",
        explanation: "Apple has probably issued 30 or 40 different bonds over the years. Some expire next year, some in 2050. Some pay 2% interest, some pay 5%. If you call a bank and say 'I want to buy an Apple bond,' they'll immediately ask 'which one?' That's why every single bond gets a unique 9-character code — no two bonds on Earth share the same one.",
        example: "037833DX5 is the CUSIP for one specific Apple bond — the one that pays 3.85% and matures in 5.2 years. 594918CE2 is a completely different Microsoft bond.",
        inProject: "All 200+ bonds in our dataset use actual CUSIPs from real Wall Street records, not made-up IDs like BOND-001.",
    },
    {
        term: "Yield Curve",
        icon: "YC",
        category: "Basics",
        oneLiner: "A graph of government interest rates at different time horizons.",
        explanation: "The government borrows money for all sorts of timeframes — 3 months, 1 year, 5 years, 10 years, 30 years. Each timeframe has its own interest rate. If you plot all those rates on a chart from shortest to longest, you get a curve. Normally it slopes upward because if you're locking your money away for 30 years, you should get paid more than someone locking it away for 3 months.",
        example: "Right now: 1-year Treasury pays about 4.2%, 5-year pays 4.0%, 10-year pays 4.3%, 30-year pays 4.6%. Plot those and you have the yield curve — that purple line at the top of the dashboard.",
        inProject: "Our dashboard fetches live Treasury rates from Yahoo Finance and draws this curve every time you open the page. It updates in real time.",
    },
    {
        term: "Nelson-Siegel Model",
        icon: "NS",
        category: "Math",
        oneLiner: "A formula that draws a smooth curve through scattered government interest rate data.",
        explanation: "The government only publishes rates for specific timeframes — 1 year, 5 year, 10 year, 30 year. But what if you need the exact rate for a 7.3-year bond? Nobody told you that. Nelson-Siegel is a math formula that takes those few known data points and draws a perfectly smooth, continuous curve through them. Now you can read the rate for any maturity you want — 3.7 years, 12.8 years, anything.",
        example: "You know the 5-year rate is 4.0% and the 10-year rate is 4.3%. Nelson-Siegel interpolates and might tell you the 7.3-year rate is approximately 4.18%.",
        inProject: "The four Nelson-Siegel parameters (beta-0, beta-1, beta-2, lambda) are displayed as cards at the top of the dashboard, right above the yield curve chart.",
    },
    {
        term: "Volatility",
        icon: "V",
        category: "Risk",
        oneLiner: "How wildly a bond's price swings up and down. High means risky, low means stable.",
        explanation: "Imagine two students. One scores 80% on every single test — boring but completely predictable. The other scores 100, then 35, then 92, then 48 — exciting but terrifying. That second student has high volatility. In bonds, a massive stable company like Coca-Cola has low volatility — its bond barely moves. A struggling company has high volatility — its bond price jumps all over the place.",
        example: "Coca-Cola bond volatility: about 3-4%. Very calm. Tesla bond volatility: about 8-12%. Wild swings. The optimizer penalizes high-volatility bonds because they make the whole portfolio unpredictable.",
        inProject: "Every bond in our dataset has a volatility number. The Sharpe Ratio calculation divides return by volatility — so lower volatility makes your score better.",
    },
    {
        term: "Covariance Matrix",
        icon: "CM",
        category: "Math",
        oneLiner: "A grid showing which bonds tend to crash together and which ones move independently.",
        explanation: "Say you invest in both Exxon and Chevron. Both are oil companies. When oil prices crash, BOTH your bonds go down at the same time — you thought you diversified but you didn't. A covariance matrix is a massive grid that maps this out for every pair of bonds. It tells the optimizer: these two move together, so don't buy both. Instead, pair an oil company with a healthcare company — oil crashing doesn't affect hospital revenues.",
        example: "Exxon and Chevron have a correlation of 0.85 (move almost identically). Exxon and Pfizer have a correlation of 0.15 (almost independent). The optimizer reads this grid and automatically diversifies across unrelated sectors.",
        inProject: "Built inside data_loader.py. Bonds in the same sector and credit tier get higher correlation values. Different sectors get lower values. This is used by both the optimizer and Monte Carlo.",
    },
    {
        term: "Sharpe Ratio",
        icon: "SR",
        category: "Core",
        oneLiner: "The ultimate scorecard: how much return are you getting per unit of risk?",
        explanation: "Two kids run lemonade stands. Kid A made a hundred rupees profit but invested ten thousand and couldn't sleep all summer worrying about the weather. Kid B made ninety rupees but only invested five hundred and barely broke a sweat. Kid B is way smarter — almost the same reward for a fraction of the stress. The Sharpe Ratio measures exactly this efficiency. Higher number means you're squeezing more return out of each unit of risk.",
        example: "Sharpe of 0.3 means meh — you're not being compensated well for the risk. Sharpe of 1.0 is solid. Sharpe above 2.0 is hedge fund territory. Our optimizer hunts for the highest possible Sharpe.",
        inProject: "This is the primary metric the optimizer maximizes when you select 'Sharpe Ratio' mode. It's displayed prominently in the results KPI cards.",
    },
    {
        term: "SLSQP Optimizer",
        icon: "SQ",
        category: "Math",
        oneLiner: "A calculus-powered algorithm that finds the best bond combination out of trillions of possibilities.",
        explanation: "Imagine a buffet with 200 dishes and you can only fill one plate. Rules: no more than 20% of any single dish, must have some vegetables, limit the junk food. There are trillions of possible plate combinations. You can't try all of them. SLSQP starts with a random plate, makes one tiny tweak, checks if the plate got better, tweaks again, checks again — thousands of times per second — until no further tweak can improve it. That's the mathematically optimal plate.",
        example: "200 bonds, 6 constraint rules. SLSQP evaluates thousands of allocations per second and converges on the optimal one in under 1 second.",
        inProject: "This runs inside brain.py every time you click 'Run Optimizer'. It uses SciPy's minimize() function with the SLSQP method.",
    },
    {
        term: "Monte Carlo Simulation",
        icon: "MC",
        category: "Risk",
        oneLiner: "Simulating 10,000 random possible futures to understand how your portfolio might behave.",
        explanation: "You've built a portfolio. Will it make money next year? Nobody on earth knows. But what if you could peek into ten thousand alternate universes? In universe number 1, the economy booms and you make fifteen thousand. In universe 4,782, there's a recession and you lose three thousand. In most universes you make a modest profit. After checking all ten thousand universes, you can confidently say something like 'in 87% of possible futures, I make money.'",
        example: "We run 10,000 simulations. 8,700 of them show a profit. 1,300 show a loss. That's a 13% probability of losing money — pretty useful to know before investing real cash.",
        inProject: "Runs automatically when you click Optimize. The results appear in the 'Monte Carlo' tab as a distribution chart showing all 10,000 outcomes.",
    },
    {
        term: "VaR (Value at Risk)",
        icon: "VR",
        category: "Risk",
        oneLiner: "The maximum you'd likely lose in a bad year, at a chosen confidence level.",
        explanation: "After running the 10,000 simulations, line up all the results from worst to best. Now look at the 500th worst one (that's the 5% mark). If that result was a loss of two thousand dollars, you can say: I'm 95% confident I won't lose more than two thousand dollars in a year. That two thousand is your 95% VaR — it's the boundary between 'normal bad luck' and 'genuinely terrible.'",
        example: "Our app might show 95% VaR = $1,819. This means: in 9,500 out of 10,000 simulated futures, the portfolio lost less than $1,819. Only 500 scenarios were worse.",
        inProject: "Displayed in the Monte Carlo tab. We show VaR at three levels: 90%, 95%, and 99% confidence.",
    },
    {
        term: "CVaR (Expected Shortfall)",
        icon: "CV",
        category: "Risk",
        oneLiner: "When the worst case happens, how bad does it actually get on average?",
        explanation: "VaR tells you the door to the danger zone — 'the worst 5% starts at a two thousand dollar loss.' But behind that door, some scenarios lost two thousand five hundred, some lost four thousand, some lost six thousand. What's the AVERAGE loss among those truly awful scenarios? That average is CVaR. Banks care about this more than VaR because it tells you the depth of the hole, not just where the hole begins.",
        example: "VaR = $1,819 means the danger zone starts there. CVaR = $2,500 means once you're in the danger zone, you lose $2,500 on average. CVaR is always equal to or worse than VaR — this is a mathematical law.",
        inProject: "Shown alongside VaR in the Monte Carlo tab. One of our unit tests explicitly verifies that CVaR is always greater than or equal to VaR.",
    },
    {
        term: "Cholesky Decomposition",
        icon: "Ch",
        category: "Math",
        oneLiner: "A math technique that makes simulated random scenarios respect real-world correlations.",
        explanation: "When running Monte Carlo, we generate random numbers for each bond's future performance. But we can't just roll a separate dice for each bond independently — because Exxon and Chevron always crash together (they're both oil). If the simulation randomly shows Exxon crashing but Chevron thriving, it's producing garbage. Cholesky decomposition takes the covariance matrix and uses it to 'link' the random numbers together so correlated bonds always move in sync, just like in real life.",
        example: "The simulation randomly generates a bad month for oil. Thanks to Cholesky, both Exxon AND Chevron automatically go down in that scenario, while Pfizer stays unaffected. Without it, results would be meaningless.",
        inProject: "Used inside risk_engine.py in the run_monte_carlo() function. The specific line is L = np.linalg.cholesky(cov_matrix).",
    },
    {
        term: "Stress Testing",
        icon: "ST",
        category: "Risk",
        oneLiner: "Running specific historical disasters on your portfolio to measure the damage.",
        explanation: "Monte Carlo generates random futures. Stress testing is different — it picks SPECIFIC nightmares from history and asks 'what if this happened again tomorrow?' What if interest rates spike by 2% overnight? What if we get a credit crisis where companies start defaulting? What if 2008 happens again? For each nightmare, we calculate exactly how many dollars your portfolio would bleed. This is literally how regulators force real banks to test their portfolios.",
        example: "Rate Shock +200bp scenario: every bond yield jumps 2 percentage points. A portfolio with duration 5 loses roughly 10% of its value. On $100k, that's a $10,000 hit.",
        inProject: "Seven predefined scenarios in the Stress Test tab. Each shows the yield change, price impact, dollar P&L, stressed volatility, and new Sharpe Ratio.",
    },
    {
        term: "Backtesting",
        icon: "BT",
        category: "Risk",
        oneLiner: "Simulating how your portfolio would have performed over the past 12 months.",
        explanation: "You built a smart robot that picks bonds. You claim it picks better than a random person. Prove it. Backtesting takes your robot's picks and runs them through 12 months of historical market conditions. Then it compares the result to two dumb strategies: buying everything equally (the lazy approach) and just buying government bonds (the do-nothing approach). If your robot beat both, it actually adds value.",
        example: "Optimized portfolio: +4.18% return over 12 months. Equal-weight portfolio: +4.35%. Risk-free: +4.07%. The difference between optimized and equal-weight is your alpha.",
        inProject: "Shown in the Backtest tab with a line chart plotting all three strategies over 12 monthly periods.",
    },
    {
        term: "Alpha",
        icon: "a",
        category: "Core",
        oneLiner: "How much better or worse your portfolio did compared to a simple benchmark.",
        explanation: "If your portfolio made 6% this year and a monkey randomly picking bonds made 4%, you generated 2% alpha. That's your edge — the value YOU added beyond what a random strategy would achieve. Positive alpha means the optimizer actually works. Negative alpha means you would have been better off picking randomly. Generating consistent positive alpha is basically the entire point of quantitative finance.",
        example: "Alpha = +0.03% means the optimized portfolio beat the equal-weight benchmark by three hundredths of a percent. Small, but consistent alpha compounds over decades.",
        inProject: "Calculated at the bottom of the Backtest tab summary. Shows alpha versus both the equal-weight benchmark and the risk-free benchmark.",
    },
    {
        term: "Efficient Frontier",
        icon: "EF",
        category: "Core",
        oneLiner: "A curve representing the absolute best possible return at each level of risk.",
        explanation: "Imagine plotting every possible bond portfolio on a chart — risk on the X axis, return on the Y axis. You'd get a massive cloud of thousands of dots. Some portfolios are good (high return, low risk — top left). Some are terrible (low return, high risk — bottom right). The upper-left edge of that cloud is the Efficient Frontier. If your portfolio sits on this line, there is mathematically no way to get higher returns without accepting more risk.",
        example: "At 5% volatility, the maximum achievable yield might be 4.8%. At 8% volatility, it's 5.6%. The Efficient Frontier connects these optimal points.",
        inProject: "Plotted in the Analytics tab as a scatter chart. A crosshair marker shows exactly where your optimized portfolio sits relative to the frontier.",
    },
    {
        term: "FINRA TRACE",
        icon: "FT",
        category: "Data",
        oneLiner: "The US government system that records every corporate bond trade to make prices visible.",
        explanation: "Stocks trade on public exchanges — Google shows you the price instantly. Bonds are different. They trade privately between banks over the phone or on private networks. For decades, nobody knew the real price of anything. Eventually the US government stepped in and said 'every bank must report every bond trade they do.' The system they built for this is called FINRA TRACE. It's the closest thing bonds have to a stock exchange's price feed.",
        example: "When JPMorgan sells a Boeing bond to Goldman Sachs for $97.52, both parties must report that trade and that price to TRACE within 15 minutes.",
        inProject: "Our 200+ bonds reference CUSIPs and pricing data consistent with FINRA TRACE records. The data source toggle on the dashboard shows 'Real (FINRA)' when using this data.",
    },
];

const categories = ["All", "Basics", "Core", "Risk", "Math", "Data"];

export default function LearnPage() {
    const [activeCategory, setActiveCategory] = useState("All");
    const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

    const filtered = activeCategory === "All" ? terms : terms.filter(t => t.category === activeCategory);

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
            {/* Hero */}
            <section className="pt-20 pb-12 px-6 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-6"
                        style={{ background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.15)", color: "var(--accent-primary)" }}>
                        Beginner Friendly
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Quant Finance <span className="gradient-text">Glossary</span>
                    </h1>
                    <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
                        Every term used in OptiMarket, explained like it&apos;s your first day in finance. No jargon, just plain English.
                    </p>
                </motion.div>
            </section>

            {/* Category Filter */}
            <section className="px-6 pb-8">
                <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 flex-wrap">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)}
                            className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
                            style={{
                                background: activeCategory === cat ? "var(--accent-primary)" : "transparent",
                                color: activeCategory === cat ? "#fff" : "var(--text-secondary)",
                                border: `1px solid ${activeCategory === cat ? "var(--accent-primary)" : "var(--border-color)"}`,
                            }}>
                            {cat} {cat !== "All" && <span className="ml-1 opacity-60">({terms.filter(t => t.category === cat).length})</span>}
                        </button>
                    ))}
                </div>
            </section>

            {/* Terms Grid */}
            <section className="px-6 pb-24">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((t, i) => (
                        <motion.div
                            key={t.term}
                            initial="hidden" whileInView="visible" viewport={{ once: true }}
                            variants={fadeUp} custom={i % 6}
                            className="rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                            style={{
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border-color)",
                            }}
                            onClick={() => setExpandedTerm(t.term)}
                        >
                            <div className="p-5 flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                                    style={{ background: "rgba(108,92,231,0.08)", color: "var(--accent-primary)", border: "1px solid rgba(108,92,231,0.12)" }}>
                                    {t.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{t.term}</h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                            style={{ background: "rgba(108,92,231,0.08)", color: "var(--accent-primary)" }}>
                                            {t.category}
                                        </span>
                                    </div>
                                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t.oneLiner}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Modal */}
            {expandedTerm && (() => {
                const t = terms.find(x => x.term === expandedTerm);
                if (!t) return null;
                return (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[300] flex items-center justify-center p-6"
                        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
                        onClick={() => setExpandedTerm(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="w-full max-w-lg rounded-3xl overflow-hidden"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-6 pb-4 flex items-start justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0"
                                        style={{ background: "rgba(108,92,231,0.08)", color: "var(--accent-primary)", border: "1px solid rgba(108,92,231,0.12)" }}>
                                        {t.icon}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{t.term}</h2>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                                style={{ background: "rgba(108,92,231,0.08)", color: "var(--accent-primary)" }}>
                                                {t.category}
                                            </span>
                                        </div>
                                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.oneLiner}</p>
                                    </div>
                                </div>
                                <button onClick={() => setExpandedTerm(null)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-colors"
                                    style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                                    &times;
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent-primary)" }}>
                                        Explained Simply
                                    </div>
                                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{t.explanation}</p>
                                </div>
                                <div className="rounded-xl p-4" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#00b894" }}>
                                        Example
                                    </div>
                                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t.example}</p>
                                </div>
                                <div className="rounded-xl p-4" style={{ background: "rgba(108,92,231,0.04)", border: "1px solid rgba(108,92,231,0.1)" }}>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent-primary)" }}>
                                        Where It&apos;s Used in OptiMarket
                                    </div>
                                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t.inProject}</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                );
            })()}

            {/* CTA */}
            <section className="py-16 px-6 text-center" style={{ borderTop: "1px solid var(--border-color)" }}>
                <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Ready to <span className="gradient-text">See It in Action</span>?
                </h2>
                <p className="text-base mb-8" style={{ color: "var(--text-secondary)" }}>
                    Now that you know the terms, launch the dashboard and optimize a real portfolio.
                </p>
                <Link href="/dashboard"
                    className="inline-block px-8 py-4 rounded-full text-base font-bold text-white transition-all duration-300 hover:scale-105"
                    style={{ background: "var(--gradient-main)" }}>
                    Launch Dashboard →
                </Link>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 text-center" style={{ borderTop: "1px solid var(--border-color)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    OptiMarket v2.0 — Real FINRA Data · Nelson-Siegel · SLSQP · Monte Carlo VaR · Stress Testing · Backtesting
                </p>
            </footer>
        </div>
    );
}
