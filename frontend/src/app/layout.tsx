import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "OptiMarket · AI-Powered Bond Portfolio Optimizer",
  description:
    "Optimize your bond portfolio using Nelson-Siegel yield curve modeling and non-linear programming. Maximize yield or Sharpe Ratio under real-world constraints.",
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
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Navbar />
        <main className="pt-20">{children}</main>
      </body>
    </html>
  );
}
