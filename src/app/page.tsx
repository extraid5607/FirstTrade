'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { Watchlist } from '@/components/Watchlist';
import { TradingViewChart } from '@/components/TradingViewChart';
import { OptionChainTable } from '@/components/OptionChainTable';
import { PositionsTable } from '@/components/PositionsTable';
import { OrderBook } from '@/components/OrderBook';
import { OrderPadModal } from '@/components/OrderPadModal';
import { AccountTab } from '@/components/AccountTab';
import { MobileNav, MobileTab } from '@/components/MobileNav';
import { useTradeStore } from '@/lib/tradeStore';
import { useAuth } from '@/lib/authContext';
import { Quote } from '@/types/market';
import { TradingSegment, OrderSide } from '@/types/trading';
import { BarChart2, Layers, Briefcase, Clock, ShieldCheck, Zap, ArrowLeft, User } from 'lucide-react';

export default function TerminalPage() {
  const { currentUser } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [centerView, setCenterView] = useState<'CHART' | 'OPTIONS'>('CHART');
  const [bottomTab, setBottomTab] = useState<'POSITIONS' | 'ORDERS' | 'ACCOUNT'>('POSITIONS');
  const [mobileTab, setMobileTab] = useState<MobileTab>('WATCHLIST');

  // Navigation & Back tracking refs
  const mobileTabRef = useRef<MobileTab>('WATCHLIST');
  mobileTabRef.current = mobileTab;
  const isOrderPadOpenRef = useRef(false);
  const centerViewRef = useRef<'CHART' | 'OPTIONS'>('CHART');
  centerViewRef.current = centerView;

  // Order Pad State
  const [isOrderPadOpen, setIsOrderPadOpen] = useState(false);
  isOrderPadOpenRef.current = isOrderPadOpen;

  const [orderPadInitial, setOrderPadInitial] = useState<{
    symbol: string;
    side: OrderSide;
    segment: TradingSegment;
    strike?: number;
    optionType?: 'CE' | 'PE';
    expiry?: string;
    lotSize?: number;
    price?: number;
  }>({
    symbol: 'NIFTY',
    side: 'BUY',
    segment: 'OPTION',
  });

  const {
    balance,
    positions,
    orders,
    portfolio,
    placeOrder,
    closePosition,
    closeAllPositions,
    cancelOrder,
    updatePrices,
    resetAccount,
  } = useTradeStore(currentUser?.username);

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  // 1. Fetch General Watchlist Quotes periodically (every 2.5s)
  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch('/api/market/quotes');
      if (res.ok) {
        const data: Quote[] = await res.json();
        setQuotes(data);

        // Update trade store price map for spot / equity positions
        const priceMap: Record<string, number> = {};
        data.forEach((q) => {
          priceMap[q.symbol] = q.ltp;
        });
        updatePrices(priceMap);
      }
    } catch (e) {
      console.error('Failed to poll quotes', e);
    }
  }, [updatePrices]);

  // 2. Fetch Live Prices Specifically for Open Positions (Options, Futures, Equities) every 2s
  const fetchPositionsQuotes = useCallback(async () => {
    const curPositions = positionsRef.current;
    if (!curPositions || curPositions.length === 0) return;

    try {
      const queryList = curPositions.map(p => ({
        id: p.id,
        symbol: p.symbol,
        segment: p.segment,
        strike: p.contractDetails?.strikePrice,
        optionType: p.contractDetails?.optionType,
        expiry: p.contractDetails?.expiryDate
      }));

      const res = await fetch('/api/market/positions-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: queryList })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.prices && Object.keys(data.prices).length > 0) {
          updatePrices(data.prices);
        }
      }
    } catch (e) {
      console.error('Failed to poll positions quotes', e);
    }
  }, [updatePrices]);

  // Launch polling intervals
  useEffect(() => {
    fetchQuotes();
    const quotesInterval = setInterval(fetchQuotes, 2500);
    return () => clearInterval(quotesInterval);
  }, [fetchQuotes]);

  useEffect(() => {
    fetchPositionsQuotes();
    const posInterval = setInterval(fetchPositionsQuotes, 2000);
    return () => clearInterval(posInterval);
  }, [fetchPositionsQuotes]);

  // Current selected quote
  const currentQuote = quotes.find((q) => q.symbol === selectedSymbol) || {
    symbol: selectedSymbol,
    name: selectedSymbol === 'SENSEX' ? 'S&P BSE SENSEX' : selectedSymbol,
    exchange: selectedSymbol === 'SENSEX' ? ('BSE' as const) : ('NSE' as const),
    segment: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'].includes(selectedSymbol) ? 'INDEX' as const : 'EQUITY' as const,
    ltp: selectedSymbol === 'NIFTY' ? 22712 : selectedSymbol === 'BANKNIFTY' ? 55153 : selectedSymbol === 'SENSEX' ? 73068 : 1215,
    open: 22650,
    high: 22720,
    low: 22630,
    close: 22620,
    dayChange: 42,
    dayChangePerc: 0.18,
    volume: 15000000,
    lotSize: selectedSymbol === 'SENSEX' ? 20 : selectedSymbol === 'BANKNIFTY' ? 30 : 65,
  };

  // Smart Navigation to tabs with Browser History integration
  const navigateToTab = useCallback((tab: MobileTab) => {
    setMobileTab(prev => {
      if (prev === tab) return prev;
      if (typeof window !== 'undefined' && tab !== 'WATCHLIST') {
        try {
          window.history.pushState({ tab }, '');
        } catch {}
      }
      return tab;
    });
  }, []);

  // Smart Back Handler
  const handleSmartBack = useCallback(() => {
    if (isOrderPadOpen) {
      setIsOrderPadOpen(false);
      return;
    }
    if (mobileTab !== 'WATCHLIST') {
      setMobileTab('WATCHLIST');
      return;
    }
    // If on WATCHLIST, trigger browser back to allow closing / exiting app
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, [isOrderPadOpen, mobileTab]);

  // Listen for browser/phone Back Button (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.history.replaceState({ tab: 'WATCHLIST' }, '');
    } catch {}

    const handlePopState = () => {
      // 1. If OrderPad modal is open, back closes modal
      if (isOrderPadOpenRef.current) {
        setIsOrderPadOpen(false);
        return;
      }

      // 2. If on any tab other than WATCHLIST, back returns to WATCHLIST
      if (mobileTabRef.current !== 'WATCHLIST') {
        setMobileTab('WATCHLIST');
        return;
      }

      // 3. If on desktop and in OPTIONS view, return to CHART
      if (centerViewRef.current === 'OPTIONS') {
        setCenterView('CHART');
        return;
      }

      // 4. If already on WATCHLIST, native browser pop will exit/close app
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenOrderPad = (
    symbol: string,
    side: OrderSide,
    segment: TradingSegment = 'EQUITY',
    strike?: number,
    optionType?: 'CE' | 'PE',
    expiry?: string,
    lotSize?: number,
    initialPrice?: number
  ) => {
    // Enforce that user must create User ID & password account before trading
    if (!currentUser) {
      alert('Please create a User ID and password in the Account tab first before trading!');
      setBottomTab('ACCOUNT');
      navigateToTab('ACCOUNT');
      return;
    }

    setSelectedSymbol(symbol);
    setOrderPadInitial({
      symbol,
      side,
      segment,
      strike,
      optionType,
      expiry,
      lotSize,
      price: initialPrice,
    });
    try {
      window.history.pushState({ modal: 'orderPad' }, '');
    } catch {}
    setIsOrderPadOpen(true);
  };

  const handleOpenOptionChain = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCenterView('OPTIONS');
    navigateToTab('OPTIONS');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100 font-sans pb-14 md:pb-0 transition-colors">
      {/* Top Header */}
      <Header
        portfolio={portfolio}
        indices={quotes.filter((q) => q.segment === 'INDEX')}
        onResetAccount={resetAccount}
        onSelectSymbol={(sym) => {
          setSelectedSymbol(sym);
          navigateToTab('CHART');
        }}
      />

      {/* DESKTOP LAYOUT (>= md) */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left: Watchlist */}
        <aside className="w-80 lg:w-96 flex-shrink-0 h-full border-r border-slate-200 dark:border-[#1E2430]">
          <Watchlist
            quotes={quotes}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym) => setSelectedSymbol(sym)}
            onOpenOrderPad={(sym, side, seg) => handleOpenOrderPad(sym, side, seg)}
            onOpenOptionChain={handleOpenOptionChain}
          />
        </aside>

        {/* Center: Main Work Area (Chart / Option Chain + Bottom Drawer) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Center Tabs Bar */}
          <div className="h-10 border-b border-slate-200 dark:border-[#1E2430] bg-white dark:bg-[#0E121A] px-3 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCenterView('CHART')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  centerView === 'CHART'
                    ? 'bg-slate-100 dark:bg-[#181F2C] text-emerald-700 dark:text-[#00D09C] border border-slate-200 dark:border-emerald-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>TradingView Chart</span>
              </button>

              <button
                onClick={() => setCenterView('OPTIONS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  centerView === 'OPTIONS'
                    ? 'bg-slate-100 dark:bg-[#181F2C] text-emerald-700 dark:text-[#00D09C] border border-slate-200 dark:border-emerald-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Option Chain ({selectedSymbol})</span>
              </button>
            </div>

            {/* Quick Fast Trade Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenOrderPad(selectedSymbol, 'BUY', currentQuote.segment === 'INDEX' ? 'OPTION' : 'EQUITY')}
                className="px-3 py-1 bg-[#00D09C] hover:bg-[#00B887] text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-xs"
              >
                <Zap className="w-3 h-3 fill-current" />
                <span>Trade {selectedSymbol}</span>
              </button>
            </div>
          </div>

          {/* Center Main View (Chart or Option Chain) */}
          <div className="flex-1 overflow-hidden relative">
            {centerView === 'CHART' ? (
              <TradingViewChart
                symbol={selectedSymbol}
                currentQuote={currentQuote}
                onOpenOptionChain={() => setCenterView('OPTIONS')}
                onTrade={(side) => handleOpenOrderPad(selectedSymbol, side, currentQuote.segment === 'INDEX' ? 'OPTION' : 'EQUITY')}
              />
            ) : (
              <OptionChainTable
                symbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                onTradeOption={(sym, strike, type, side, ltp, exp, lot) => {
                  handleOpenOrderPad(sym, side, 'OPTION', strike, type, exp, lot, ltp);
                }}
              />
            )}
          </div>

          {/* Bottom Drawer: Positions & Orders */}
          <section className="h-56 lg:h-64 border-t border-slate-200 dark:border-[#1E2430] bg-white dark:bg-[#0E121A] flex flex-col transition-colors">
            <div className="h-9 border-b border-slate-200 dark:border-[#1E2430] bg-slate-50/70 dark:bg-[#0E121A] px-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBottomTab('POSITIONS')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                    bottomTab === 'POSITIONS' ? 'bg-slate-200/80 dark:bg-[#1E2536] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Briefcase className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Positions ({positions.length})</span>
                </button>
                <button
                  onClick={() => setBottomTab('ORDERS')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                    bottomTab === 'ORDERS' ? 'bg-slate-200/80 dark:bg-[#1E2536] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Orders ({orders.length})</span>
                </button>
                <button
                  onClick={() => setBottomTab('ACCOUNT')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                    bottomTab === 'ACCOUNT' ? 'bg-slate-200/80 dark:bg-[#1E2536] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3 h-3 text-purple-500" />
                  <span>Account {currentUser ? `(${currentUser.username})` : '(Login/Sign Up)'}</span>
                </button>
              </div>

              {/* Unrealized P&L quick pill */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Demo P&L:</span>
                <span className={`font-mono font-bold tabular-nums ${
                  portfolio.totalUnrealizedPnL >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
                }`}>
                  {portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalUnrealizedPnL.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {bottomTab === 'POSITIONS' && (
                <PositionsTable
                  positions={positions}
                  onClosePosition={closePosition}
                  onCloseAllPositions={closeAllPositions}
                />
              )}
              {bottomTab === 'ORDERS' && (
                <OrderBook orders={orders} onCancelOrder={cancelOrder} />
              )}
              {bottomTab === 'ACCOUNT' && (
                <AccountTab
                  portfolio={portfolio}
                  onResetAccount={resetAccount}
                  onNavigateToWatchlist={() => setBottomTab('POSITIONS')}
                />
              )}
            </div>
          </section>
        </main>
      </div>

      {/* MOBILE LAYOUT (< md) */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        {/* Mobile Smart Back Header (shown whenever on any tab other than Watchlist) */}
        {mobileTab !== 'WATCHLIST' && (
          <div className="h-10 px-3 bg-white dark:bg-[#0E121A] border-b border-slate-200 dark:border-[#1E2430] flex items-center justify-between transition-colors flex-shrink-0 z-20">
            <button
              onClick={handleSmartBack}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#00D09C] py-1 px-2 -ml-1 rounded-lg bg-slate-100 dark:bg-[#141926] border border-slate-200 dark:border-[#1F2636] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#00D09C]" />
              <span>Watchlist</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {mobileTab === 'CHART' && `${selectedSymbol} Chart`}
                {mobileTab === 'OPTIONS' && `${selectedSymbol} Option Chain`}
                {mobileTab === 'POSITIONS' && 'Positions'}
                {mobileTab === 'ORDERS' && 'Order Book'}
                {mobileTab === 'ACCOUNT' && 'Account'}
              </span>
              {mobileTab === 'CHART' && currentQuote?.ltp && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-[#00D09C] font-mono font-bold">
                  ₹{currentQuote.ltp.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        )}

        {mobileTab === 'WATCHLIST' && (
          <Watchlist
            quotes={quotes}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym) => {
              setSelectedSymbol(sym);
              navigateToTab('CHART');
            }}
            onOpenOrderPad={(sym, side, seg) => handleOpenOrderPad(sym, side, seg)}
            onOpenOptionChain={handleOpenOptionChain}
          />
        )}

        {mobileTab === 'CHART' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <TradingViewChart
              symbol={selectedSymbol}
              currentQuote={currentQuote}
              onOpenOptionChain={() => navigateToTab('OPTIONS')}
              onTrade={(side) => handleOpenOrderPad(selectedSymbol, side, currentQuote.segment === 'INDEX' ? 'OPTION' : 'EQUITY')}
            />
          </div>
        )}

        {mobileTab === 'OPTIONS' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <OptionChainTable
              symbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              onTradeOption={(sym, strike, type, side, ltp, exp, lot) => {
                handleOpenOrderPad(sym, side, 'OPTION', strike, type, exp, lot, ltp);
              }}
            />
          </div>
        )}

        {mobileTab === 'POSITIONS' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <PositionsTable
              positions={positions}
              onClosePosition={closePosition}
              onCloseAllPositions={closeAllPositions}
            />
          </div>
        )}

        {mobileTab === 'ORDERS' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <OrderBook orders={orders} onCancelOrder={cancelOrder} />
          </div>
        )}

        {mobileTab === 'ACCOUNT' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <AccountTab
              portfolio={portfolio}
              onResetAccount={resetAccount}
              onNavigateToWatchlist={() => navigateToTab('WATCHLIST')}
            />
          </div>
        )}

        {/* Mobile Floating Action Button (Trade) */}
        {mobileTab !== 'POSITIONS' && mobileTab !== 'ORDERS' && mobileTab !== 'ACCOUNT' && (
          <div className="fixed bottom-16 right-4 z-30">
            <button
              onClick={() => handleOpenOrderPad(selectedSymbol, 'BUY', currentQuote.segment === 'INDEX' ? 'OPTION' : 'EQUITY')}
              className="px-4 py-3 bg-[#00D09C] hover:bg-[#00B887] text-black font-extrabold text-sm rounded-full shadow-xl flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Trade {selectedSymbol}</span>
            </button>
          </div>
        )}

        {/* Mobile Bottom Navigation */}
        <MobileNav
          activeTab={mobileTab}
          onSelectTab={navigateToTab}
          openPositionsCount={positions.length}
        />
      </div>

      {/* Global Order Pad Modal */}
      <OrderPadModal
        isOpen={isOrderPadOpen}
        onClose={() => setIsOrderPadOpen(false)}
        initialSymbol={orderPadInitial.symbol}
        initialSide={orderPadInitial.side}
        initialSegment={orderPadInitial.segment}
        initialStrike={orderPadInitial.strike}
        initialOptionType={orderPadInitial.optionType}
        initialExpiry={orderPadInitial.expiry}
        initialLotSize={orderPadInitial.lotSize}
        initialPrice={orderPadInitial.price}
        currentQuote={currentQuote}
        availableBalance={portfolio.availableCash}
        onPlaceOrder={placeOrder}
      />
    </div>
  );
}
