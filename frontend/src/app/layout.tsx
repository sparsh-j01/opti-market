import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "OptiMarket · Quantitative Bond Portfolio Optimizer",
  description:
    "Optimize your bond portfolio using Nelson-Siegel yield curve modeling and non-linear programming. Maximize yield or Sharpe Ratio under real-world constraints.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Literata:opsz,wght@7..72,400..600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Literata', Georgia, serif" }}>
        <Navbar />
        <main className="pt-20">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
