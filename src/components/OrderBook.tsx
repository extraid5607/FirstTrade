'use client';

import React, { useState } from 'react';
import { Order } from '@/types/trading';
import { X, Clock, CheckCircle2, Ban } from 'lucide-react';
import { formatExpiryBadge, formatExpiryFull } from '@/lib/constants';

interface OrderBookProps {
  orders: Order[];
  onCancelOrder: (id: string) => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({
  orders,
  onCancelOrder,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'EXECUTED' | 'PENDING'>('ALL');

  const filteredOrders = orders.filter(o => {
    if (filter === 'EXECUTED') return o.status === 'EXECUTED';
    if (filter === 'PENDING') return o.status === 'PENDING';
    return true;
  });

  if (orders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E121A] transition-colors">
        <Clock className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-400">Order Book is Empty</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-0.5">Placed demo orders will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0E121A] select-none text-xs transition-colors">
      {/* Filter Tabs */}
      <div className="p-3 border-b border-slate-200 dark:border-[#1E2430] bg-slate-50/70 dark:bg-[#0F131C] flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141926] p-0.5 rounded-lg border border-slate-200 dark:border-[#202738]">
          {(['ALL', 'PENDING', 'EXECUTED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === f 
                  ? 'bg-white dark:bg-[#222A3A] text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f} ({orders.filter(o => f === 'ALL' ? true : o.status === f).length})
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead className="bg-slate-100 dark:bg-[#121622] text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2430] sticky top-0">
            <tr>
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Instrument</th>
              <th className="py-2 px-3">Product</th>
              <th className="py-2 px-3 text-right">Qty</th>
              <th className="py-2 px-3 text-right">Order Price (₹)</th>
              <th className="py-2 px-3 text-center">Status</th>
              <th className="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#171C26]">
            {filteredOrders.map(order => {
              const timeStr = new Date(order.timestamp).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              const isOption = order.segment === 'OPTION' && !!order.contractDetails?.strikePrice;
              const expBadge = isOption ? formatExpiryBadge(order.contractDetails?.expiryDate, order.symbol) : '';
              const expFull = isOption ? formatExpiryFull(order.contractDetails?.expiryDate, order.symbol) : '';

              const instrumentTitle = order.contractDetails?.optionType
                ? `${order.symbol} ${order.contractDetails.strikePrice} ${order.contractDetails.optionType}`
                : order.symbol;

              return (
                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-[#141926] transition-colors">
                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{timeStr}</td>
                  <td className="py-2 px-3">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                      order.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}>
                      {order.side} {order.type}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5 flex-wrap">
                      <span>{instrumentTitle}</span>
                      {expBadge && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                          {expBadge}
                        </span>
                      )}
                    </div>
                    {expFull && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        Exp: {expFull}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{order.product}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">{order.quantity}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    ₹{order.filledPrice ? order.filledPrice.toFixed(2) : order.price.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      order.status === 'EXECUTED'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : order.status === 'PENDING'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-slate-200 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => onCancelOrder(order.id)}
                        className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white transition-colors text-[10px] font-bold"
                      >
                        Cancel
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
