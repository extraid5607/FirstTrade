'use client';

import React, { useState } from 'react';
import { Quote } from '@/types/market';
import { TrendingUp, TrendingDown, Layers, BarChart2, Zap } from 'lucide-react';

interface WatchlistProps {
  quotes: Quote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onOpenOrderPad: (symbol: string, side: 'BUY' | 'SELL', segment?: 'EQUITY' | 'OPTION' | 'FUTURE') => void;
  onOpenOptionChain: (symbol: string) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  quotes,
  selectedSymbol,
  onSelectSymbol,
  onOpenOrderPad,
  onOpenOptionChain,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'INDICES' | 'FNO'>('ALL');

  const filteredQuotes = quotes.filter(q => {
    if (filter === 'INDICES') return q.segment === 'INDEX';
    if (filter === 'FNO') return q.segment === 'EQUITY';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0E121A] border-r border-slate-200 dark:border-[#1E2430] select-none transition-colors">
      {/* Watchlist Filter Header */}
      <div className="p-3 border-b border-slate-200 dark:border-[#1E2430] flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141924] p-0.5 rounded-lg border border-slate-200 dark:border-[#202737] w-full">
          <button
            onClick={() => setFilter('ALL')}
            className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all ${
              filter === 'ALL'
                ? 'bg-white dark:bg-[#22293A] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All ({quotes.length})
          </button>
          <button
            onClick={() => setFilter('INDICES')}
            className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all ${
              filter === 'INDICES'
                ? 'bg-white dark:bg-[#22293A] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Indices
          </button>
          <button
            onClick={() => setFilter('FNO')}
            className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all ${
              filter === 'FNO'
                ? 'bg-white dark:bg-[#22293A] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            F&O Stocks
          </button>
        </div>
      </div>

      {/* Instruments List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#171C26]">
        {filteredQuotes.map((item) => {
          const isSelected = item.symbol === selectedSymbol;
          const isPositive = item.dayChange >= 0;

          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol(item.symbol)}
              className={`group p-3 cursor-pointer transition-colors relative ${
                isSelected
                  ? 'bg-emerald-50/70 dark:bg-[#161C28] border-l-2 border-[#00D09C]'
                  : 'hover:bg-slate-50 dark:hover:bg-[#131722]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-[#1C2230] text-slate-500 dark:text-slate-400 font-mono border border-slate-200 dark:border-transparent">
                      {item.segment === 'INDEX' ? 'IND' : 'NSE'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] sm:max-w-[150px]">
                    {item.name}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹{item.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[11px] font-mono font-medium flex items-center justify-end gap-0.5 tabular-nums ${
                    isPositive ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
                  }`}>
                    {isPositive ? '+' : ''}{item.dayChange.toFixed(1)} ({isPositive ? '+' : ''}{item.dayChangePerc.toFixed(2)}%)
                  </div>
                </div>
              </div>

              {/* Action Buttons (Appears on hover or selected) */}
              <div className={`mt-2 pt-2 border-t border-slate-200 dark:border-[#1F2636] flex items-center gap-1.5 ${
                isSelected ? 'flex' : 'hidden group-hover:flex'
              }`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOrderPad(item.symbol, 'BUY', item.segment === 'INDEX' ? 'OPTION' : 'EQUITY');
                  }}
                  className="flex-1 py-1 rounded bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-[#00D09C] border border-emerald-500/30 text-[11px] font-bold text-center transition-colors"
                >
                  BUY
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOrderPad(item.symbol, 'SELL', item.segment === 'INDEX' ? 'OPTION' : 'EQUITY');
                  }}
                  className="flex-1 py-1 rounded bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 dark:text-[#EB5B3C] border border-rose-500/30 text-[11px] font-bold text-center transition-colors"
                >
                  SELL
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOptionChain(item.symbol);
                  }}
                  title="View Option Chain"
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-[#1C2230] hover:bg-slate-200 dark:hover:bg-[#252E42] text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition-colors border border-slate-200 dark:border-transparent"
                >
                  <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Options</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
