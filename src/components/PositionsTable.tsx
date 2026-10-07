'use client';

import React, { useState } from 'react';
import { Position } from '@/types/trading';
import { LogOut, ArrowUpRight, ArrowDownRight, ShieldAlert, CheckCircle2, Check, Clock } from 'lucide-react';
import { formatExpiryBadge, formatExpiryFull } from '@/lib/constants';

interface PositionsTableProps {
  positions: Position[];
  onClosePosition: (id: string) => void;
  onCloseAllPositions: () => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  onClosePosition,
  onCloseAllPositions,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  const openPositions = positions.filter(p => p.status !== 'CLOSED');
  const closedPositions = positions.filter(p => p.status === 'CLOSED');

  const totalUnrealizedPnL = openPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
  const totalRealizedPnL = closedPositions.reduce((acc, p) => acc + (p.realizedPnL || 0), 0);
  const totalTodayPnL = totalUnrealizedPnL + totalRealizedPnL;

  const filteredPositions = positions.filter(p => {
    if (filter === 'OPEN') return p.status !== 'CLOSED';
    if (filter === 'CLOSED') return p.status === 'CLOSED';
    return true;
  });

  if (positions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E121A] transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#141926] flex items-center justify-center text-slate-400 mb-3 border border-slate-200 dark:border-[#202738]">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No Positions Today</p>
        <p className="text-[11px] text-slate-500 max-w-xs mt-1">
          Pick any Stock, Option, or Future from the Watchlist or Option Chain to start your demo trade with live market prices!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0E121A] select-none text-xs transition-colors">
      {/* Positions Header Bar */}
      <div className="p-2.5 sm:p-3 border-b border-slate-200 dark:border-[#1E2430] bg-slate-50/70 dark:bg-[#0F131C] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter sub-tabs */}
          <div className="flex items-center bg-slate-200/80 dark:bg-[#141926] p-0.5 rounded-lg border border-slate-300 dark:border-[#202738]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === 'ALL'
                  ? 'bg-white dark:bg-[#222A3A] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({positions.length})
            </button>
            <button
              onClick={() => setFilter('OPEN')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === 'OPEN'
                  ? 'bg-white dark:bg-[#222A3A] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Open ({openPositions.length})
            </button>
            <button
              onClick={() => setFilter('CLOSED')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === 'CLOSED'
                  ? 'bg-white dark:bg-[#222A3A] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Closed ({closedPositions.length})
            </button>
          </div>

          {/* Realized vs Unrealized breakdown pill */}
          <div className="hidden sm:flex items-center gap-3 pl-2 border-l border-slate-300 dark:border-[#1F2636] text-[11px]">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Booked: </span>
              <strong className={`font-mono tabular-nums ${totalRealizedPnL >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'}`}>
                {totalRealizedPnL >= 0 ? '+' : ''}₹{totalRealizedPnL.toFixed(2)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">MTM: </span>
              <strong className={`font-mono tabular-nums ${totalUnrealizedPnL >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'}`}>
                {totalUnrealizedPnL >= 0 ? '+' : ''}₹{totalUnrealizedPnL.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Total Today P&L */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#161C28] border border-slate-200 dark:border-[#222A3A]">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Today P&L:</span>
            <span className={`font-mono font-bold tabular-nums text-xs ${
              totalTodayPnL >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
            }`}>
              {totalTodayPnL >= 0 ? '+' : ''}₹{totalTodayPnL.toFixed(2)}
            </span>
          </div>

          {openPositions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Square off all open demo positions at market price?')) {
                  onCloseAllPositions();
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[#EB5B3C] border border-rose-500/20 text-[11px] font-bold flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>Exit All ({openPositions.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* MOBILE VIEW (< md): Zerodha/Groww style dedicated cards */}
      <div className="md:hidden flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#171C26] pb-16">
        {filteredPositions.map((pos) => {
          const isClosed = pos.status === 'CLOSED';
          const pnl = isClosed ? (pos.realizedPnL || 0) : pos.unrealizedPnL;
          const isProfit = pnl >= 0;

          const isOption = pos.segment === 'OPTION' && !!pos.contractDetails?.strikePrice;
          const expBadge = isOption ? formatExpiryBadge(pos.contractDetails?.expiryDate, pos.symbol) : '';
          const expFull = isOption ? formatExpiryFull(pos.contractDetails?.expiryDate, pos.symbol) : '';

          const title = pos.contractDetails?.optionType
            ? `${pos.symbol} ${pos.contractDetails.strikePrice} ${pos.contractDetails.optionType}`
            : pos.symbol;

          return (
            <div
              key={pos.id}
              className={`p-3 transition-colors ${
                isClosed ? 'bg-slate-50/50 dark:bg-[#10141D]/60 opacity-80' : 'bg-white dark:bg-[#0E121A]'
              }`}
            >
              {/* Row 1: Symbol, Tag, and Main P&L */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
                      {title}
                    </span>
                    {expBadge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                        {expBadge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    <span className={`font-bold ${pos.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pos.side}
                    </span>
                    <span>•</span>
                    <span>{pos.product === 'INTRADAY' ? 'MIS' : 'CNC'}</span>
                    <span>•</span>
                    <span>Qty: {isClosed ? '0 (Exited)' : pos.quantity}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`font-mono font-bold tabular-nums text-sm ${
                    isProfit ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
                  }`}>
                    {isProfit ? '+' : ''}₹{pnl.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {isClosed ? 'Booked' : `${isProfit ? '+' : ''}${pos.unrealizedPnLPerc.toFixed(2)}%`}
                  </div>
                </div>
              </div>

              {/* Row 2: Price details & Action button */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-[#161C26] text-[11px]">
                <div className="flex items-center gap-3 font-mono text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase block">Avg</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      ₹{pos.averagePrice.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase block">
                      {isClosed ? 'Exit' : 'LTP'}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      ₹{(isClosed ? (pos.exitPrice || pos.currentPrice) : pos.currentPrice).toFixed(2)}
                    </span>
                  </div>
                  {expFull && (
                    <div className="hidden sm:block">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase block">Exp</span>
                      <span className="text-[10px] text-slate-700 dark:text-slate-300">{expFull}</span>
                    </div>
                  )}
                </div>

                <div>
                  {isClosed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#161B24] border border-slate-200 dark:border-[#222834]">
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Closed</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => onClosePosition(pos.id)}
                      className="px-3 py-1 rounded bg-rose-500/10 hover:bg-rose-500 text-[#EB5B3C] hover:text-white border border-rose-500/20 text-[11px] font-bold transition-all shadow-xs"
                    >
                      Exit
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP VIEW (>= md): Full Data Table */}
      <div className="hidden md:block flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-slate-100 dark:bg-[#121622] text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2430] sticky top-0 z-10">
            <tr>
              <th className="py-2 px-3">Status & Instrument</th>
              <th className="py-2 px-3">Product</th>
              <th className="py-2 px-3 text-right">Qty</th>
              <th className="py-2 px-3 text-right">Avg Entry (₹)</th>
              <th className="py-2 px-3 text-right">LTP / Exit (₹)</th>
              <th className="py-2 px-3 text-right">Today's P&L (₹)</th>
              <th className="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#171C26]">
            {filteredPositions.map((pos) => {
              const isClosed = pos.status === 'CLOSED';
              const pnl = isClosed ? (pos.realizedPnL || 0) : pos.unrealizedPnL;
              const isProfit = pnl >= 0;

              const isOption = pos.segment === 'OPTION' && !!pos.contractDetails?.strikePrice;
              const expBadge = isOption ? formatExpiryBadge(pos.contractDetails?.expiryDate, pos.symbol) : '';
              const expFull = isOption ? formatExpiryFull(pos.contractDetails?.expiryDate, pos.symbol) : '';

              const title = pos.contractDetails?.optionType
                ? `${pos.symbol} ${pos.contractDetails.strikePrice} ${pos.contractDetails.optionType}`
                : pos.symbol;

              const closedTimeStr = pos.closedAt ? new Date(pos.closedAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              }) : '';

              return (
                <tr 
                  key={pos.id} 
                  className={`transition-colors ${
                    isClosed 
                      ? 'bg-slate-50/40 dark:bg-[#11151E]/60 opacity-85 hover:opacity-100' 
                      : 'hover:bg-slate-50 dark:hover:bg-[#141926]'
                  }`}
                >
                  {/* Symbol & Status Badge */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      {isClosed ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                          CLOSED
                        </span>
                      ) : (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                          pos.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}>
                          {pos.side}
                        </span>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5 flex-wrap">
                          <span>{title}</span>
                          {expBadge && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs">
                              {expBadge}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span>{pos.segment}</span>
                          {expFull && (
                            <>
                              <span>•</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium">Exp: {expFull}</span>
                            </>
                          )}
                          {isClosed && (
                            <>
                              <span>•</span>
                              <span>Exited {closedTimeStr}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {pos.product === 'INTRADAY' ? 'MIS' : 'CNC'}
                  </td>

                  {/* Qty */}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {isClosed ? (
                      <span className="text-slate-400 font-normal">0 (Exited)</span>
                    ) : (
                      pos.quantity
                    )}
                  </td>

                  {/* Avg Entry Price */}
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    ₹{pos.averagePrice.toFixed(2)}
                  </td>

                  {/* LTP / Exit Price */}
                  <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                    {isClosed ? (
                      <span className="text-slate-600 dark:text-slate-300">
                        ₹{(pos.exitPrice || pos.currentPrice).toFixed(2)}
                      </span>
                    ) : (
                      `₹${pos.currentPrice.toFixed(2)}`
                    )}
                  </td>

                  {/* P&L */}
                  <td className="py-2.5 px-3 text-right">
                    <div className={`font-mono font-bold tabular-nums text-xs ${
                      isProfit ? 'text-[#00D09C]' : 'text-[#EB5B3C]'
                    }`}>
                      {isProfit ? '+' : ''}₹{pnl.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {isClosed ? 'Booked P&L' : `(${isProfit ? '+' : ''}${pos.unrealizedPnLPerc.toFixed(2)}%)`}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-2.5 px-3 text-center">
                    {isClosed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#161B24] border border-slate-200 dark:border-[#222834]">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Closed</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => onClosePosition(pos.id)}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#202738] hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-all border border-slate-200 dark:border-transparent"
                      >
                        Exit
                      </button>
                    )}
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
