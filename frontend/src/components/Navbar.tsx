"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function Navbar() {
    const pathname = usePathname();

    return (
        <motion.nav
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] glass"
            style={{
                borderRadius: "100px",
                padding: "0 8px",
                boxShadow: "0 4px 30px rgba(0, 0, 0, 0.06)",
            }}
        >
            <div className="flex items-center gap-1 h-14 px-4">
                <Link href="/" className="flex items-center gap-1 group mr-6">
                    <span
                        className="text-lg font-bold"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}
                    >
                        Opti<span className="gradient-text">Market</span>
                    </span>
                </Link>

                <div className="flex items-center gap-1">
                    <Link
                        href="/"
                        className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
                        style={{
                            background: pathname === "/" ? "rgba(108, 92, 231, 0.08)" : "transparent",
                            color: pathname === "/" ? "var(--accent-primary)" : "var(--text-secondary)",
                        }}
                    >
                        Home
                    </Link>
                    <Link
                        href="/dashboard"
                        className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
                        style={{
                            background: pathname === "/dashboard" ? "rgba(108, 92, 231, 0.08)" : "transparent",
                            color: pathname === "/dashboard" ? "var(--accent-primary)" : "var(--text-secondary)",
                        }}
                    >
                        Dashboard
                    </Link>

                </div>
            </div>
        </motion.nav>
    );
}
