import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/themeContext";
import { AuthProvider } from "@/lib/authContext";
import { PWAInstaller } from "@/components/PWAInstaller";
import "./globals.css";

export const metadata: Metadata = {
  title: "FirstTrade - Indian Stock & F&O Demo Trading Terminal",
  description: "Live real-time paper trading terminal for Indian markets. Trade Options, Futures, and Stocks with live NSE data, Option Chain with Greeks, and TradingView charts.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FirstTrade",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#00D09C",
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body className="bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100 min-h-screen selection:bg-emerald-500/30 selection:text-emerald-700 dark:selection:text-emerald-200">
        <ThemeProvider>
          <AuthProvider>
            <PWAInstaller />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
