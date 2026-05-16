"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

/* Emil Kowalski: built-in eases lack punch; this is a strong ease-out. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const LINKS = [
    { href: "/", label: "Home" },
    { href: "/learn", label: "Learn" },
    { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
    const pathname = usePathname();
    const reduce = useReducedMotion();

    return (
        // `transform` string (not FM's `y` shorthand): the navbar mounts during
        // the heaviest main-thread moment — initial page load — where rAF-driven
        // props drop frames. The transform string stays GPU-composited.
        <motion.nav
            className="fixed top-0 left-0 right-0 z-[200]"
            style={{
                background: "var(--paper)",
                borderBottom: "1px solid var(--hairline)",
            }}
            initial={reduce ? { opacity: 0 } : { transform: "translateY(-16px)", opacity: 0 }}
            animate={{ transform: "translateY(0px)", opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
        >
            {/* aligned to the centered ruler-spine shell (46px left rail) */}
            <div className="mx-auto max-w-[1280px] flex items-center h-16 pl-[46px] pr-6 max-[640px]:pl-5">
                <Link href="/" className="mr-10 flex items-baseline gap-2">
                    <span
                        className="text-lg font-semibold tracking-tight"
                        style={{ fontFamily: "'Fraunces', Georgia, serif", color: "var(--ink)" }}
                    >
                        OptiMarket
                    </span>
                    <span className="mono-label hidden sm:inline">Bond Optimizer</span>
                </Link>

                <div className="flex items-center gap-1">
                    {LINKS.map((l) => {
                        const active = pathname === l.href;
                        return (
                            <Link
                                key={l.href}
                                href={l.href}
                                className="press relative px-3 py-2 text-sm transition-colors duration-150"
                                style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    fontSize: "0.6875rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.12em",
                                    color: active ? "var(--ink)" : "var(--muted)",
                                }}
                            >
                                {l.label}
                                {/* Shared-element underline: it slides between
                                    tabs instead of hard-cutting (Emil: motion
                                    should carry continuity, not announce). The
                                    rule stays a 1px ink hairline per DESIGN.md. */}
                                {active && (
                                    <motion.span
                                        layoutId="nav-underline"
                                        className="absolute left-0 right-0 bottom-0"
                                        style={{ height: "1px", background: "var(--ink)" }}
                                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </motion.nav>
    );
}
