'use client';

import React, { useState, useEffect, useRef } from 'react';
import { OptionChainData, OptionStrikeRow, OptionContract } from '@/types/market';
import { 
  Calendar, 
  Layers, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal,
  ChevronDown,
  Info,
  Radio
} from 'lucide-react';

interface OptionChainTableProps {
  symbol: string;
  onTradeOption: (
    symbol: string,
    strike: number,
    optionType: 'CE' | 'PE',
    side: 'BUY' | 'SELL',
    ltp: number,
    expiryDate: string,
    lotSize: number
  ) => void;
  onSelectSymbol?: (symbol: string) => void;
}

const AVAILABLE_INDICES = [
  { symbol: 'NIFTY', name: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', name: 'BANK NIFTY' },
  { symbol: 'SENSEX', name: 'SENSEX (BSE)' },
  { symbol: 'FINNIFTY', name: 'FINNIFTY' },
  { symbol: 'MIDCPNIFTY', name: 'MIDCP NIFTY' },
];

export const OptionChainTable: React.FC<OptionChainTableProps> = ({
  symbol,
  onTradeOption,
  onSelectSymbol,
}) => {
  const [data, setData] = useState<OptionChainData | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showGreeks, setShowGreeks] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const selectedExpiryRef = useRef<string>('');

  selectedExpiryRef.current = selectedExpiry;

  // Fetch Option Chain function
  const loadOptionChain = async (exp?: string, isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const activeExp = exp || selectedExpiryRef.current;
      const url = `/api/market/option-chain?symbol=${encodeURIComponent(symbol)}${activeExp ? '&expiry=' + encodeURIComponent(activeExp) : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load option chain');
      const chain: OptionChainData = await res.json();
      setData(chain);
      if (!selectedExpiryRef.current && chain.selectedExpiry) {
        setSelectedExpiry(chain.selectedExpiry);
      }
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Option chain error', err);
    } finally {
      if (!isBackground) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load on symbol change
  useEffect(() => {
    setSelectedExpiry('');
    selectedExpiryRef.current = '';
    loadOptionChain();
  }, [symbol]);

  // Periodic Auto-refresh every 2.5s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadOptionChain(selectedExpiryRef.current, true);
    }, 2500);
    return () => clearInterval(interval);
  }, [symbol, autoRefresh]);

  const handleExpiryChange = (exp: string) => {
    setSelectedExpiry(exp);
    selectedExpiryRef.current = exp;
    loadOptionChain(exp, false);
  };

  if (!data && isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-white dark:bg-[#0E121A]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Loading {symbol} Live Option Chain from NSE/Groww...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.strikes || data.strikes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E121A]">
        No option contracts found for {symbol} on this expiry.
      </div>
    );
  }

  const spot = data.underlyingValue;
  const atm = data.atmStrike;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0E121A] select-none text-xs transition-colors">
      {/* Option Chain Top Control Bar */}
      <div className="p-2.5 sm:p-3 border-b border-slate-200 dark:border-[#1E2430] bg-slate-50/70 dark:bg-[#0F131C] flex flex-wrap items-center justify-between gap-2.5">
        {/* Underlying spot and indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {onSelectSymbol ? (
              <div className="relative">
                <select
                  value={symbol}
                  onChange={(e) => onSelectSymbol(e.target.value)}
                  className="bg-slate-100 dark:bg-[#151A26] border border-slate-200 dark:border-[#202738] text-slate-900 dark:text-white font-bold rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer pr-6 appearance-none shadow-xs"
                >
                  {AVAILABLE_INDICES.map(idx => (
                    <option key={idx.symbol} value={idx.symbol}>
                      {idx.name}
                    </option>
                  ))}
                  {!AVAILABLE_INDICES.some(i => i.symbol === symbol) && (
                    <option value={symbol}>{symbol}</option>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
              </div>
            ) : (
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{data.underlying}</span>
            )}
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Spot: ₹{spot.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">
              PCR: <strong className={`font-mono ${data.pcr > 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{data.pcr}</strong>
            </span>
            {data.maxPain && (
              <span className="text-[11px]">
                Max Pain: <strong className="font-mono text-amber-600 dark:text-amber-400">₹{data.maxPain}</strong>
              </span>
            )}
            <span className="text-[11px]">
              Lot Size: <strong className="font-mono text-slate-900 dark:text-white">{data.lotSize}</strong>
            </span>
          </div>
        </div>

        {/* Expiry Selector and Controls */}
        <div className="flex items-center gap-2">
          {/* Live Pulsing Auto-Refresh Badge */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Auto-refresh is ON (Every 2.5s). Click to pause." : "Auto-refresh is OFF. Click to enable."}
            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
              autoRefresh 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' 
                : 'bg-slate-100 dark:bg-[#151A26] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#202738]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'}`} />
            <span>{autoRefresh ? 'LIVE' : 'PAUSED'}</span>
          </button>

          {/* Expiry Date dropdown */}
          <div className="relative">
            <select
              value={selectedExpiry}
              onChange={(e) => handleExpiryChange(e.target.value)}
              className="bg-slate-100 dark:bg-[#151A26] border border-slate-200 dark:border-[#202738] text-slate-900 dark:text-white rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer pr-7 appearance-none"
            >
              {data.expiryDates.map((exp) => (
                <option key={exp} value={exp}>
                  Expiry: {exp}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>

          {/* Toggle Greeks */}
          <button
            onClick={() => setShowGreeks(!showGreeks)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
              showGreeks
                ? 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                : 'bg-slate-100 dark:bg-[#151A26] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#202738] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">Greeks</span>
          </button>

          {/* Manual Refresh button */}
          <button
            onClick={() => loadOptionChain(selectedExpiryRef.current, false)}
            title="Refresh Option Chain"
            className="p-1 rounded-lg bg-slate-100 dark:bg-[#151A26] border border-slate-200 dark:border-[#202738] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          {/* Table Super Header */}
          <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#121622] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2430]">
            <tr>
              <th colSpan={showGreeks ? 6 : 4} className="py-1.5 px-3 text-center text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-r border-slate-200 dark:border-[#1E2430]">
                CALL OPTIONS (CE)
              </th>
              <th className="py-1.5 px-3 text-center text-[11px] font-bold text-slate-900 dark:text-slate-200 bg-slate-200/70 dark:bg-[#161B28]">
                STRIKE
              </th>
              <th colSpan={showGreeks ? 6 : 4} className="py-1.5 px-3 text-center text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-l border-slate-200 dark:border-[#1E2430]">
                PUT OPTIONS (PE)
              </th>
            </tr>
            {/* Column sub-header */}
            <tr className="bg-slate-50 dark:bg-[#10141E] text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2430]">
              <th className="py-1.5 px-2 text-right">OI (Lakh)</th>
              {showGreeks && <th className="py-1.5 px-2 text-right">IV</th>}
              {showGreeks && <th className="py-1.5 px-2 text-right">Delta</th>}
              <th className="py-1.5 px-2 text-right">Volume</th>
              <th className="py-1.5 px-2 text-right">LTP (₹)</th>
              <th className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-[#1E2430]">Trade</th>

              <th className="py-1.5 px-3 text-center font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-[#151926]">Strike Price</th>

              <th className="py-1.5 px-2 text-center border-l border-slate-200 dark:border-[#1E2430]">Trade</th>
              <th className="py-1.5 px-2 text-left">LTP (₹)</th>
              <th className="py-1.5 px-2 text-left">Volume</th>
              {showGreeks && <th className="py-1.5 px-2 text-left">Delta</th>}
              {showGreeks && <th className="py-1.5 px-2 text-left">IV</th>}
              <th className="py-1.5 px-2 text-left">OI (Lakh)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-[#171C26]">
            {data.strikes.map((row) => {
              const strike = row.strikePrice;
              const isATM = Math.abs(strike - atm) < (data.lotSize > 100 ? 15 : 26);
              const isCallITM = strike < spot;
              const isPutITM = strike > spot;

              const ce = row.callOption;
              const pe = row.putOption;
              const activeTradeExpiry = selectedExpiry || data.selectedExpiry || data.expiryDates?.[0] || '';

              return (
                <tr
                  key={strike}
                  className={`hover:bg-slate-50 dark:hover:bg-[#151B29] transition-colors ${
                    isATM ? 'bg-amber-50/60 dark:bg-[#182030]/80 font-semibold' : ''
                  }`}
                >
                  {/* CALLS SIDE */}
                  {/* Call OI */}
                  <td className={`py-1.5 px-2 text-right font-mono tabular-nums ${isCallITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                    {ce?.openInterest ? (ce.openInterest / 100000).toFixed(2) : '-'}
                  </td>

                  {/* Call IV */}
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-right font-mono tabular-nums text-purple-700 dark:text-purple-300 ${isCallITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                      {ce?.impliedVolatility ? `${ce.impliedVolatility}%` : '-'}
                    </td>
                  )}

                  {/* Call Delta */}
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 ${isCallITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                      {ce?.delta !== undefined ? ce.delta : '-'}
                    </td>
                  )}

                  {/* Call Volume */}
                  <td className={`py-1.5 px-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 ${isCallITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                    {ce?.volume ? (ce.volume > 100000 ? `${(ce.volume / 100000).toFixed(1)}L` : ce.volume) : '-'}
                  </td>

                  {/* Call LTP */}
                  <td className={`py-1.5 px-2 text-right font-mono font-bold tabular-nums ${
                    isCallITM ? 'bg-amber-500/5 dark:bg-amber-950/10 text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {ce ? `₹${ce.ltp.toFixed(2)}` : '-'}
                  </td>

                  {/* Call Quick Actions (Buy & Sell) */}
                  <td className={`py-1.5 px-2 text-center border-r border-slate-200 dark:border-[#1E2430] ${isCallITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                    {ce && ce.ltp > 0 && (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onTradeOption(symbol, strike, 'CE', 'BUY', ce.ltp, activeTradeExpiry, data.lotSize)}
                          title={`BUY ${symbol} ${strike} CE @ ₹${ce.ltp}`}
                          className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] tracking-wide transition-colors shadow-xs"
                        >
                          B
                        </button>
                        <button
                          onClick={() => onTradeOption(symbol, strike, 'CE', 'SELL', ce.ltp, activeTradeExpiry, data.lotSize)}
                          title={`SELL ${symbol} ${strike} CE @ ₹${ce.ltp}`}
                          className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] tracking-wide transition-colors shadow-xs"
                        >
                          S
                        </button>
                      </div>
                    )}
                  </td>

                  {/* STRIKE PRICE (Center) */}
                  <td className={`py-1.5 px-3 text-center font-mono font-bold tabular-nums text-slate-900 dark:text-white bg-slate-100 dark:bg-[#131722] ${
                    isATM ? 'text-amber-600 dark:text-amber-400 ring-1 ring-amber-400/50' : ''
                  }`}>
                    <div className="flex items-center justify-center gap-1">
                      <span>{strike}</span>
                      {isATM && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                          ATM
                        </span>
                      )}
                    </div>
                  </td>

                  {/* PUTS SIDE */}
                  {/* Put Quick Actions (Buy & Sell) */}
                  <td className={`py-1.5 px-2 text-center border-l border-slate-200 dark:border-[#1E2430] ${isPutITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                    {pe && pe.ltp > 0 && (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onTradeOption(symbol, strike, 'PE', 'BUY', pe.ltp, activeTradeExpiry, data.lotSize)}
                          title={`BUY ${symbol} ${strike} PE @ ₹${pe.ltp}`}
                          className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] tracking-wide transition-colors shadow-xs"
                        >
                          B
                        </button>
                        <button
                          onClick={() => onTradeOption(symbol, strike, 'PE', 'SELL', pe.ltp, activeTradeExpiry, data.lotSize)}
                          title={`SELL ${symbol} ${strike} PE @ ₹${pe.ltp}`}
                          className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] tracking-wide transition-colors shadow-xs"
                        >
                          S
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Put LTP */}
                  <td className={`py-1.5 px-2 text-left font-mono font-bold tabular-nums ${
                    isPutITM ? 'bg-amber-500/5 dark:bg-amber-950/10 text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {pe ? `₹${pe.ltp.toFixed(2)}` : '-'}
                  </td>

                  {/* Put Volume */}
                  <td className={`py-1.5 px-2 text-left font-mono tabular-nums text-slate-500 dark:text-slate-400 ${isPutITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                    {pe?.volume ? (pe.volume > 100000 ? `${(pe.volume / 100000).toFixed(1)}L` : pe.volume) : '-'}
                  </td>

                  {/* Put Delta */}
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-left font-mono tabular-nums text-slate-700 dark:text-slate-300 ${isPutITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                      {pe?.delta !== undefined ? pe.delta : '-'}
                    </td>
                  )}

                  {/* Put IV */}
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-left font-mono tabular-nums text-purple-700 dark:text-purple-300 ${isPutITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                      {pe?.impliedVolatility ? `${pe.impliedVolatility}%` : '-'}
                    </td>
                  )}

                  {/* Put OI */}
                  <td className={`py-1.5 px-2 text-left font-mono tabular-nums ${isPutITM ? 'bg-amber-500/5 dark:bg-amber-950/10' : ''}`}>
                    {pe?.openInterest ? (pe.openInterest / 100000).toFixed(2) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
