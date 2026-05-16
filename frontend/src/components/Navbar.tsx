"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
    { href: "/", label: "Home" },
    { href: "/learn", label: "Learn" },
    { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-[200]"
            style={{
                background: "var(--paper)",
                borderBottom: "1px solid var(--hairline)",
            }}
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
                                className="press px-3 py-2 text-sm transition-colors duration-150"
                                style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    fontSize: "0.6875rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.12em",
                                    color: active ? "var(--ink)" : "var(--muted)",
                                    borderBottom: active
                                        ? "1px solid var(--ink)"
                                        : "1px solid transparent",
                                }}
                            >
                                {l.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
