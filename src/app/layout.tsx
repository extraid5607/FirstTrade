import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/themeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "FirstTrade - Indian Stock & F&O Demo Trading Terminal",
  description: "Live real-time paper trading terminal for Indian markets. Trade Options, Futures, and Stocks with live NSE data, Option Chain with Greeks, and TradingView charts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100 min-h-screen selection:bg-emerald-500/30 selection:text-emerald-700 dark:selection:text-emerald-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
