'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Quote } from '@/types/market';
import { PortfolioSummary } from '@/types/trading';
import { useTheme } from '@/lib/themeContext';
import { 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  Search, 
  Wallet, 
  Activity, 
  ShieldCheck,
  X,
  Sun,
  Moon
} from 'lucide-react';

interface HeaderProps {
  portfolio: PortfolioSummary;
  indices: Quote[];
  onResetAccount: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  portfolio,
  indices,
  onResetAccount,
  onSelectSymbol,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search autocomplete
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.slice(0, 8));
        }
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const nifty = indices.find(i => i.symbol === 'NIFTY');
  const bankNifty = indices.find(i => i.symbol === 'BANKNIFTY');
  const sensex = indices.find(i => i.symbol === 'SENSEX');
  const finNifty = indices.find(i => i.symbol === 'FINNIFTY');

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#0E121A]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1E2430] transition-colors">
      {/* Top Bar */}
      <div className="max-w-[1720px] mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Market Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelectSymbol('NIFTY')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00D09C] to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-4 h-4 text-black font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">FirstTrade</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-[#00D09C] border border-emerald-500/20">
                  DEMO
                </span>
              </div>
            </div>
          </div>

          {/* Market Status Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#161B26] border border-slate-200 dark:border-[#232A3B] text-xs">
            <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse"></span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">NSE / BSE LIVE</span>
            <span className="text-slate-500 text-[11px]">09:15 - 15:30 IST</span>
          </div>
        </div>

        {/* Live Index Ribbon (Center) */}
        <div className="hidden md:flex items-center gap-3 lg:gap-5 bg-slate-100 dark:bg-[#121622] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1E2433]">
          {nifty && (
            <div 
              onClick={() => onSelectSymbol('NIFTY')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">NIFTY 50</span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {nifty.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[11px] font-mono font-medium flex items-center ${nifty.dayChange >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'}`}>
                {nifty.dayChange >= 0 ? '+' : ''}{nifty.dayChange.toFixed(1)} ({nifty.dayChangePerc >= 0 ? '+' : ''}{nifty.dayChangePerc.toFixed(2)}%)
              </span>
            </div>
          )}

          {bankNifty && (
            <div 
              onClick={() => onSelectSymbol('BANKNIFTY')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity border-l border-slate-300 dark:border-[#22283A] pl-3"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">BANK NIFTY</span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {bankNifty.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[11px] font-mono font-medium flex items-center ${bankNifty.dayChange >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'}`}>
                {bankNifty.dayChange >= 0 ? '+' : ''}{bankNifty.dayChange.toFixed(1)} ({bankNifty.dayChangePerc >= 0 ? '+' : ''}{bankNifty.dayChangePerc.toFixed(2)}%)
              </span>
            </div>
          )}

          {sensex && (
            <div 
              onClick={() => onSelectSymbol('SENSEX')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity border-l border-slate-300 dark:border-[#22283A] pl-3"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">SENSEX</span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {sensex.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[11px] font-mono font-medium flex items-center ${sensex.dayChange >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'}`}>
                {sensex.dayChange >= 0 ? '+' : ''}{sensex.dayChange.toFixed(1)} ({sensex.dayChangePerc >= 0 ? '+' : ''}{sensex.dayChangePerc.toFixed(2)}%)
              </span>
            </div>
          )}

          {finNifty && (
            <div 
              onClick={() => onSelectSymbol('FINNIFTY')}
              className="hidden 2xl:flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity border-l border-slate-300 dark:border-[#22283A] pl-3"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">FINNIFTY</span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {finNifty.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[11px] font-mono font-medium flex items-center ${finNifty.dayChange >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'}`}>
                {finNifty.dayChange >= 0 ? '+' : ''}{finNifty.dayChange.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Right Section: Search & Virtual Balance & Theme Switcher */}
        <div className="flex items-center gap-2">
          {/* Search Trigger */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1A2030] border border-slate-200 dark:border-[#22293A] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search stocks, F&O...</span>
            <kbd className="hidden sm:inline text-[10px] bg-slate-200 dark:bg-[#1E2433] px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-[#2B3448]">Ctrl+K</kbd>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#141926] hover:bg-slate-200 dark:hover:bg-[#1E2536] border border-slate-200 dark:border-[#21293B] text-slate-700 dark:text-slate-300 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* Virtual Account Balance Card */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#141926] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#21293B]">
            <Wallet className="w-4 h-4 text-[#00D09C]" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 leading-none">Demo Funds</span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums leading-tight">
                ₹{portfolio.availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Total P&L badge */}
            <div className={`ml-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold tabular-nums flex items-center gap-0.5 ${
              portfolio.totalUnrealizedPnL >= 0 
                ? 'bg-emerald-500/15 text-[#00D09C] border border-emerald-500/25' 
                : 'bg-rose-500/15 text-[#EB5B3C] border border-rose-500/25'
            }`}>
              {portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalUnrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
            </div>

            {/* Reset Balance Button */}
            <button
              onClick={() => {
                if (window.confirm('Reset virtual balance to ₹10,00,000 and clear all demo trades?')) {
                  onResetAccount();
                }
              }}
              title="Reset Demo Balance to ₹10 Lakhs"
              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-[#202738] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Global Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#121622] rounded-2xl border border-slate-200 dark:border-[#262E42] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 border-b border-slate-200 dark:border-[#1E2536] flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. RELIANCE, TCS, NIFTY)..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button 
                onClick={() => { setShowSearchModal(false); setSearchQuery(''); }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2536]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-[#1B202F]">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">Searching market instruments...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectSymbol(item.symbol);
                      setShowSearchModal(false);
                      setSearchQuery('');
                    }}
                    className="p-2.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#1A2030] rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">{item.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#202738] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2C354A]">
                          {item.segment}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{item.name}</div>
                    </div>
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Select</span>
                  </div>
                ))
              ) : searchQuery ? (
                <div className="p-4 text-center text-xs text-slate-500">No instruments found matching "{searchQuery}"</div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">Type any stock or index name to search</div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
