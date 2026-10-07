'use client';

import React, { useState, useEffect } from 'react';
import { TradingSegment, OrderSide, OrderProduct, OrderType } from '@/types/trading';
import { Quote } from '@/types/market';
import { TradeOrderParams } from '@/lib/tradeStore';
import { X, AlertCircle, CheckCircle2, ChevronRight, Layers, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { formatExpiryBadge, formatExpiryFull, getDefaultExpiry } from '@/lib/constants';

interface OrderPadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSymbol: string;
  initialSide: OrderSide;
  initialSegment: TradingSegment;
  initialStrike?: number;
  initialOptionType?: 'CE' | 'PE';
  initialExpiry?: string;
  initialLotSize?: number;
  initialPrice?: number;
  currentQuote?: Quote;
  availableBalance: number;
  onPlaceOrder: (params: TradeOrderParams) => { success: boolean; message: string };
}

export const OrderPadModal: React.FC<OrderPadModalProps> = ({
  isOpen,
  onClose,
  initialSymbol,
  initialSide,
  initialSegment,
  initialStrike,
  initialOptionType,
  initialExpiry,
  initialLotSize,
  initialPrice,
  currentQuote,
  availableBalance,
  onPlaceOrder,
}) => {
  const [segment, setSegment] = useState<TradingSegment>(initialSegment);
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [product, setProduct] = useState<OrderProduct>('INTRADAY');
  const [type, setType] = useState<OrderType>('MARKET');
  
  const [lotSize, setLotSize] = useState<number>(initialLotSize || currentQuote?.lotSize || 65);
  const [lots, setLots] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(lotSize);
  
  // Option specific state
  const [strikePrice, setStrikePrice] = useState<number>(initialStrike || 0);
  const [optionType, setOptionType] = useState<'CE' | 'PE'>(initialOptionType || 'CE');
  const [expiryDate, setExpiryDate] = useState<string>(initialExpiry || '');
  const [availableExpiries, setAvailableExpiries] = useState<string[]>([]);
  const [optionPremium, setOptionPremium] = useState<number>(initialPrice || 0);
  const [isLoadingOptionLtp, setIsLoadingOptionLtp] = useState(false);

  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [triggerPrice, setTriggerPrice] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Initialize state whenever modal opens or props change
  useEffect(() => {
    if (!isOpen) return;

    setSegment(initialSegment);
    setSide(initialSide);
    const lSize = initialLotSize || currentQuote?.lotSize || (initialSegment === 'EQUITY' ? 1 : 65);
    setLotSize(lSize);
    setLots(1);
    setQuantity(lSize);

    const step = (initialSymbol === 'BANKNIFTY' || initialSymbol === 'SENSEX') ? 100 : initialSymbol === 'NIFTY' ? 50 : 20;

    if (initialStrike) {
      setStrikePrice(initialStrike);
    } else if (currentQuote?.ltp) {
      setStrikePrice(Math.round(currentQuote.ltp / step) * step);
    }

    if (initialOptionType) setOptionType(initialOptionType);
    if (initialExpiry) setExpiryDate(initialExpiry);

    if (initialSegment === 'OPTION') {
      if (initialPrice && initialPrice > 0) {
        setOptionPremium(initialPrice);
        setLimitPrice(initialPrice);
      } else {
        const fallbackStrike = currentQuote?.ltp 
          ? Math.round(currentQuote.ltp / step) * step 
          : (initialSymbol === 'SENSEX' ? 73000 : 22700);
        fetchOptionStrikeLtp(initialSymbol, initialStrike || fallbackStrike, initialOptionType || 'CE', initialExpiry);
      }
    } else {
      const stockPrice = currentQuote?.ltp || 100;
      setLimitPrice(stockPrice);
    }
  }, [isOpen, initialSymbol, initialSide, initialSegment, initialStrike, initialOptionType, initialExpiry, initialLotSize, initialPrice, currentQuote]);

  // Fetch live LTP when user changes strike or CE/PE in options mode
  const fetchOptionStrikeLtp = async (sym: string, strike: number, optType: 'CE' | 'PE', exp?: string) => {
    if (!strike || strike <= 0) return;
    setIsLoadingOptionLtp(true);
    try {
      const activeExp = exp || expiryDate;
      const url = `/api/market/option-chain?symbol=${encodeURIComponent(sym)}${activeExp ? '&expiry=' + encodeURIComponent(activeExp) : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const chain = await res.json();
        if (chain.expiryDates && chain.expiryDates.length > 0) {
          setAvailableExpiries(chain.expiryDates);
        }
        if (!exp && !expiryDate && chain.selectedExpiry) {
          setExpiryDate(chain.selectedExpiry);
        }
        const found = chain.strikes?.find((s: any) => Math.round(s.strikePrice) === Math.round(strike));
        if (found) {
          const ltp = optType === 'CE' ? found.callOption?.ltp : found.putOption?.ltp;
          if (ltp !== undefined && ltp > 0) {
            setOptionPremium(ltp);
            setLimitPrice(ltp);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch strike LTP', e);
    } finally {
      setIsLoadingOptionLtp(false);
    }
  };

  const handleStrikeChange = (newStrike: number) => {
    setStrikePrice(newStrike);
    fetchOptionStrikeLtp(initialSymbol, newStrike, optionType, expiryDate);
  };

  const handleOptionTypeChange = (newType: 'CE' | 'PE') => {
    setOptionType(newType);
    fetchOptionStrikeLtp(initialSymbol, strikePrice, newType, expiryDate);
  };

  const handleExpiryChange = (newExp: string) => {
    setExpiryDate(newExp);
    fetchOptionStrikeLtp(initialSymbol, strikePrice, optionType, newExp);
  };

  if (!isOpen) return null;

  let activeLtp = 0;
  if (segment === 'OPTION') {
    activeLtp = optionPremium || 10;
  } else if (segment === 'FUTURE') {
    activeLtp = currentQuote?.ltp ? Math.round(currentQuote.ltp * 1.002 * 100) / 100 : 100;
  } else {
    activeLtp = currentQuote?.ltp || 100;
  }

  const executionPrice = type === 'MARKET' ? activeLtp : limitPrice;

  let requiredMargin = 0;
  if (segment === 'EQUITY') {
    const totalVal = quantity * executionPrice;
    requiredMargin = product === 'INTRADAY' ? totalVal * 0.2 : totalVal;
  } else if (segment === 'OPTION') {
    if (side === 'BUY') {
      requiredMargin = quantity * executionPrice;
    } else {
      const spotVal = (strikePrice || currentQuote?.ltp || 22700);
      requiredMargin = quantity * spotVal * 0.15;
    }
  } else if (segment === 'FUTURE') {
    requiredMargin = quantity * executionPrice * 0.15;
  }

  requiredMargin = Math.round(requiredMargin * 100) / 100;
  const isMarginSufficient = availableBalance >= requiredMargin;

  const handleLotsChange = (newLots: number) => {
    const validLots = Math.max(1, newLots);
    setLots(validLots);
    setQuantity(validLots * lotSize);
  };

  const handleSubmit = () => {
    const params: TradeOrderParams = {
      symbol: initialSymbol,
      name: currentQuote?.name || initialSymbol,
      segment,
      side,
      product,
      type,
      quantity,
      price: Math.round(executionPrice * 100) / 100,
      triggerPrice: type === 'SL' ? triggerPrice : undefined,
      contractDetails: segment === 'OPTION' ? {
        strikePrice: strikePrice || 0,
        optionType,
        expiryDate: expiryDate || availableExpiries[0] || getDefaultExpiry(initialSymbol),
        lotSize,
      } : segment === 'FUTURE' ? {
        lotSize,
      } : undefined,
    };

    const res = onPlaceOrder(params);
    setToastMessage({ text: res.message, isError: !res.success });

    if (res.success) {
      setTimeout(() => {
        setToastMessage(null);
        onClose();
      }, 700);
    }
  };

  const spotVal = currentQuote?.ltp || 22700;
  const step = initialSymbol === 'BANKNIFTY' ? 100 : initialSymbol === 'NIFTY' ? 50 : 20;
  const atmApprox = Math.round(spotVal / step) * step;
  const strikeOptions = [
    atmApprox - step * 3,
    atmApprox - step * 2,
    atmApprox - step,
    atmApprox,
    atmApprox + step,
    atmApprox + step * 2,
    atmApprox + step * 3,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#121622] sm:rounded-2xl border border-slate-200 dark:border-[#232B3D] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
        
        {/* Modal Top Header with BUY / SELL side banner */}
        <div className={`p-4 flex items-center justify-between text-white ${
          side === 'BUY' ? 'bg-[#00D09C]/15 border-b border-[#00D09C]/30' : 'bg-[#EB5B3C]/15 border-b border-[#EB5B3C]/30'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold text-black ${
                side === 'BUY' ? 'bg-[#00D09C]' : 'bg-[#EB5B3C] text-white'
              }`}>
                {side}
              </span>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">{initialSymbol}</span>
              {segment === 'OPTION' ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                    {strikePrice} {optionType}
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                    {formatExpiryBadge(expiryDate, initialSymbol)}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                  {segment}
                </span>
              )}
            </div>
            
            {/* Live Price Row */}
            <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 mt-1">
              {segment === 'OPTION' ? (
                <>
                  <div className="flex items-center gap-1">
                    <span>Option Premium:</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      ₹{optionPremium.toFixed(2)}
                    </strong>
                    {isLoadingOptionLtp && <RefreshCw className="w-3 h-3 animate-spin text-emerald-500 ml-1" />}
                  </div>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">Spot: ₹{spotVal.toFixed(1)}</span>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <span>LTP:</span>
                  <strong className="font-mono text-slate-900 dark:text-white font-bold text-sm">₹{activeLtp.toFixed(2)}</strong>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Segment Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Trading Segment</label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#161C28] p-1 rounded-xl border border-slate-200 dark:border-[#22293A]">
              {(['EQUITY', 'OPTION', 'FUTURE'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSegment(s)}
                  className={`py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                    segment === s
                      ? 'bg-white dark:bg-[#252E42] text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Option Strike, Type & Expiry Controls (Only shown for Options) */}
          {segment === 'OPTION' && (
            <div className="grid grid-cols-3 gap-2 bg-slate-100/70 dark:bg-[#151A26] p-2.5 rounded-xl border border-slate-200 dark:border-[#22293A]">
              {/* Option Type CE / PE */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Type</label>
                <div className="flex bg-white dark:bg-[#0E121A] p-0.5 rounded-lg border border-slate-200 dark:border-[#202738]">
                  <button
                    onClick={() => handleOptionTypeChange('CE')}
                    className={`flex-1 py-1 rounded font-bold text-xs transition-colors ${
                      optionType === 'CE' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    CE
                  </button>
                  <button
                    onClick={() => handleOptionTypeChange('PE')}
                    className={`flex-1 py-1 rounded font-bold text-xs transition-colors ${
                      optionType === 'PE' ? 'bg-rose-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    PE
                  </button>
                </div>
              </div>

              {/* Strike Price Select */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Strike</label>
                <select
                  value={strikePrice}
                  onChange={(e) => handleStrikeChange(Number(e.target.value))}
                  className="w-full bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-[#202738] rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {strikeOptions.map(st => (
                    <option key={st} value={st}>
                      {st} {st === atmApprox ? '(ATM)' : ''}
                    </option>
                  ))}
                  {!strikeOptions.includes(strikePrice) && strikePrice > 0 && (
                    <option value={strikePrice}>{strikePrice}</option>
                  )}
                </select>
              </div>

              {/* Expiry Date Select */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Expiry</label>
                <select
                  value={expiryDate || availableExpiries[0] || getDefaultExpiry(initialSymbol)}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  className="w-full bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-[#202738] rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {(availableExpiries.length > 0 ? availableExpiries : [getDefaultExpiry(initialSymbol)]).map(exp => (
                    <option key={exp} value={exp}>
                      {formatExpiryBadge(exp, initialSymbol)}
                    </option>
                  ))}
                  {!availableExpiries.includes(expiryDate) && expiryDate && (
                    <option value={expiryDate}>{formatExpiryBadge(expiryDate, initialSymbol)}</option>
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Side Switcher (BUY / SELL) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide('BUY')}
              className={`py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                side === 'BUY'
                  ? 'bg-[#00D09C] text-black shadow-md shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-[#181E2B] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#232A3B]'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              BUY {segment === 'OPTION' ? (optionType === 'CE' ? '(Bullish)' : '(Bearish)') : ''}
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={`py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                side === 'SELL'
                  ? 'bg-[#EB5B3C] text-white shadow-md shadow-rose-500/20'
                  : 'bg-slate-100 dark:bg-[#181E2B] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#232A3B]'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              SELL (Short)
            </button>
          </div>

          {/* Product Type & Order Type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Product</label>
              <div className="flex bg-slate-100 dark:bg-[#161C28] p-0.5 rounded-xl border border-slate-200 dark:border-[#22293A]">
                <button
                  onClick={() => setProduct('INTRADAY')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] ${
                    product === 'INTRADAY' ? 'bg-white dark:bg-[#252E42] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Intraday (MIS)
                </button>
                <button
                  onClick={() => setProduct('DELIVERY')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] ${
                    product === 'DELIVERY' ? 'bg-white dark:bg-[#252E42] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {segment === 'OPTION' || segment === 'FUTURE' ? 'NRML' : 'CNC'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Order Type</label>
              <div className="flex bg-slate-100 dark:bg-[#161C28] p-0.5 rounded-xl border border-slate-200 dark:border-[#22293A]">
                <button
                  onClick={() => setType('MARKET')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] ${
                    type === 'MARKET' ? 'bg-white dark:bg-[#252E42] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Market
                </button>
                <button
                  onClick={() => {
                    setType('LIMIT');
                    setLimitPrice(activeLtp);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] ${
                    type === 'LIMIT' ? 'bg-white dark:bg-[#252E42] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Limit
                </button>
              </div>
            </div>
          </div>

          {/* Quantity & Lots Controller */}
          <div className="space-y-1.5 bg-slate-100/70 dark:bg-[#151A26] p-3 rounded-xl border border-slate-200 dark:border-[#22293A]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Quantity {segment !== 'EQUITY' ? `(${lots} Lot = ${quantity} Qty)` : 'Shares'}
              </span>
              <span className="text-slate-500 text-[11px]">Lot Size: {lotSize}</span>
            </div>

            <div className="flex items-center gap-2">
              {segment !== 'EQUITY' ? (
                <>
                  <button
                    onClick={() => handleLotsChange(lots - 1)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-[#202738] hover:bg-slate-200 dark:hover:bg-[#2A344A] text-slate-900 dark:text-white font-bold text-base flex items-center justify-center transition-colors border border-slate-200 dark:border-transparent"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={lots}
                    onChange={(e) => handleLotsChange(parseInt(e.target.value) || 1)}
                    className="flex-1 bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-[#283247] rounded-lg py-2 px-3 text-center text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => handleLotsChange(lots + 1)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-[#202738] hover:bg-slate-200 dark:hover:bg-[#2A344A] text-slate-900 dark:text-white font-bold text-base flex items-center justify-center transition-colors border border-slate-200 dark:border-transparent"
                  >
                    +
                  </button>
                </>
              ) : (
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-[#283247] rounded-lg py-2 px-3 text-center text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              )}
            </div>

            {/* Quick Multipliers for Lots */}
            {segment !== 'EQUITY' && (
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 5, 10].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleLotsChange(m)}
                    className={`flex-1 py-1 rounded text-[10px] font-mono font-semibold transition-colors ${
                      lots === m 
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                        : 'bg-white dark:bg-[#202738] hover:bg-slate-200 dark:hover:bg-[#283247] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {m} Lot{m > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Limit Price Input */}
          {type === 'LIMIT' && (
            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Limit Price (₹)</label>
              <input
                type="number"
                step="0.05"
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-[#283247] rounded-xl py-2 px-3 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Margin & Account Overview Bar */}
          <div className="bg-slate-100/70 dark:bg-[#151926] p-3 rounded-xl border border-slate-200 dark:border-[#202739] space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Required Margin:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums text-xs">
                ₹{requiredMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Available Demo Balance:</span>
              <span className={`font-mono font-bold tabular-nums text-xs ${isMarginSufficient ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                ₹{availableBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Toast / Notification */}
          {toastMessage && (
            <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
              toastMessage.isError ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            }`}>
              {toastMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Submit Order Button */}
          <button
            onClick={handleSubmit}
            disabled={!isMarginSufficient}
            className={`w-full py-3 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg ${
              !isMarginSufficient
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : side === 'BUY'
                ? 'bg-[#00D09C] hover:bg-[#00B887] text-black shadow-emerald-500/20'
                : 'bg-[#EB5B3C] hover:bg-[#D84A2C] text-white shadow-rose-500/20'
            }`}
          >
            {side} {quantity} Qty {segment === 'OPTION' ? `${strikePrice} ${optionType}` : initialSymbol} @ ₹{executionPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
};
