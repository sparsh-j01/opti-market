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
            className="fixed top-0 left-0 right-0 z-50 glass"
            style={{ borderBottom: "1px solid rgba(42, 42, 106, 0.3)" }}
        >
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: "linear-gradient(135deg, #00d2ff, #3a7bd5)" }}>
                        📈
                    </div>
                    <span className="text-lg font-bold gradient-text">OptiMarket</span>
                </Link>

                <div className="flex items-center gap-8">
                    <Link
                        href="/"
                        className={`text-sm font-medium transition-colors duration-200 ${pathname === "/" ? "text-[#00d2ff]" : "text-[#8888bb] hover:text-[#e8e8ff]"
                            }`}
                    >
                        Home
                    </Link>
                    <Link
                        href="/dashboard"
                        className={`text-sm font-medium transition-colors duration-200 ${pathname === "/dashboard" ? "text-[#00d2ff]" : "text-[#8888bb] hover:text-[#e8e8ff]"
                            }`}
                    >
                        Dashboard
                    </Link>
                    <Link
                        href="/dashboard"
                        className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_4px_20px_rgba(0,210,255,0.3)]"
                        style={{ background: "linear-gradient(135deg, #3a7bd5, #00d2ff)" }}
                    >
                        Launch App →
                    </Link>
                </div>
            </div>
        </motion.nav>
    );
}
