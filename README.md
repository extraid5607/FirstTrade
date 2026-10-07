# 🚀 FirstTrade - Indian Stock & F&O Demo Trading Terminal

A high-performance demo trading terminal for the Indian Stock Market (**NSE/BSE**) featuring **real LIVE market prices**, **interactive Option Chains with Black-Scholes Greeks**, **Futures & Stock Trading**, and **TradingView Candlestick Charts**. Built with a clean, minimal **Groww-style dark UI** optimized for both Web and Mobile.

---

## 🌟 Key Features

### 1. ⚡ Real Live Market Prices (NSE / Groww Feed)
- **Live Equities & Indices**: Live prices for **NIFTY 50**, **BANK NIFTY**, **FINNIFTY**, **MIDCPNIFTY**, and top NSE F&O stocks (Reliance, HDFC Bank, TCS, INFY, ICICI Bank, Tata Motors, SBIN, etc.).
- **Automatic Tick Polling**: Updates every 2.5 seconds with live green/red flash tick indicators.
- **Instant Search**: Search across any NSE stock or index (`Ctrl+K` shortcut).

### 2. 📊 Live Option Chain with Greeks (Groww / Sensibull Style)
- **Direct Live Groww Feed**: Real-time Call (CE) and Put (PE) option chains for NIFTY, BANK NIFTY, FINNIFTY, and equity stocks.
- **Black-Scholes Greeks Engine**: Real-time Delta, Theta, Gamma, Vega, and Implied Volatility (IV) calculations.
- **Market Sentiment Indicators**: Live **PCR (Put-Call Ratio)**, **Max Pain**, Total Call OI vs Put OI.
- **At-The-Money (ATM) Highlight**: Visual ATM strike indicator and In-The-Money (ITM) depth shading.
- **1-Click Trade Execution**: Click `B` on any CE or PE strike to instantly open the order pad with pre-filled strike and live premium!

### 3. 📈 TradingView Candlestick Charts
- Powered by official TradingView **Lightweight Charts**.
- Multi-timeframe switcher: `1M`, `5M`, `15M`, `1H`, `1D`.
- Technical indicators: **EMA 9**, **EMA 21**, and **Volume Histogram**.
- Real-time candle updates and magnet crosshair tooltip.

### 4. 💼 Comprehensive Paper Trading Engine
- **Initial Demo Funds**: Starting virtual capital of **₹10,00,000 (10 Lakhs INR)**.
- **3 Trading Segments**:
  1. **Equity (Stocks)**: Intraday (MIS with 5x leverage) and Delivery (CNC with 1x margin).
  2. **Options**: CE & PE option buying (100% premium) and option writing with margin calculation.
  3. **Futures**: Index & Stock futures with realistic lot sizes and SPAN margin.
- **Order Types**: `MARKET` (instant fill at LTP) and `LIMIT` orders.
- **Live Mark-To-Market (MTM) P&L**: Dynamic unrealized and realized P&L calculated on every incoming price tick.
- **Position Management**: 1-click individual square-off or "Exit All Positions".
- **Local Persistence**: Trades, portfolio balance, and order history are automatically saved in browser `localStorage`.
- **Reset Balance**: 1-click button to reset virtual capital back to ₹10 Lakhs.

### 5. 📱 Dual Web & Mobile Responsive Layout
- **Desktop Terminal**: Multi-pane pro workspace with Left Watchlist, Center TradingView Chart / Option Chain, and Bottom Positions & Order Book drawer.
- **Mobile Terminal**: Touch-optimized interface with native-feel Bottom Navigation (`Watchlist`, `Chart`, `Options`, `Positions`, `Orders`) and quick-access floating Trade button.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router) & React 19
- **Styling**: Tailwind CSS with custom Groww minimal dark theme
- **Charting**: TradingView Lightweight Charts (`lightweight-charts`)
- **Icons**: Lucide React
- **Pricing & Options Engine**: Groww Public API + Yahoo Finance + Black-Scholes Formula

---

## 🚀 Getting Started

### Development Server
```bash
npm run dev
```

### Production Build & Server
```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
