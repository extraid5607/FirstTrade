'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Order, Position, PortfolioSummary, OrderSide, OrderProduct, OrderType, TradingSegment } from '@/types/trading';
import { INITIAL_DEMO_CAPITAL, getDefaultExpiry } from '@/lib/constants';
import { cleanAndSettlePositions, isOptionExpired } from '@/lib/expiry';

const getStorageKey = (key: string, userId?: string) => {
  if (!userId) return `first_trade_guest_${key}`;
  return `first_trade_${userId.trim().toLowerCase()}_${key}`;
};

export interface TradeOrderParams {
  symbol: string;
  name: string;
  segment: TradingSegment;
  side: OrderSide;
  product: OrderProduct;
  type: OrderType;
  quantity: number;
  price: number;
  triggerPrice?: number;
  contractDetails?: {
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: string;
    lotSize?: number;
  };
}

// Check if a timestamp occurred on the current calendar day (before 11:59:59 PM)
export function isToday(timestamp?: number): boolean {
  if (!timestamp) return true;
  const date = new Date(timestamp);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate();
}

export function useTradeStore(userId?: string, isAuthReady: boolean = true) {
  const cleanUser = userId ? userId.trim().toLowerCase() : undefined;

  const [balance, setBalance] = useState<number>(INITIAL_DEMO_CAPITAL);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // References to guarantee no race-conditions or accidental state wiping
  const loadedForUserRef = useRef<string | null>(null);
  const isInitialSyncDoneRef = useRef(false);
  const lastSavedHashRef = useRef<string>('');

  // Load from Cloud Redis (with localStorage immediate cache) when user changes or auth is ready
  useEffect(() => {
    if (!isAuthReady) return;

    let isCancelled = false;
    loadedForUserRef.current = null;
    isInitialSyncDoneRef.current = false;
    setIsLoaded(false);

    async function loadTrades() {
      const targetUser = cleanUser || '__guest__';
      const balanceKey = getStorageKey('balance', cleanUser);
      const positionsKey = getStorageKey('positions', cleanUser);
      const ordersKey = getStorageKey('orders', cleanUser);

      // 1. Immediate local cache retrieval
      let curBal = INITIAL_DEMO_CAPITAL;
      let curPos: Position[] = [];
      let curOrd: Order[] = [];

      const localBal = localStorage.getItem(balanceKey);
      const localPos = localStorage.getItem(positionsKey);
      const localOrd = localStorage.getItem(ordersKey);

      if (localBal) {
        try { curBal = JSON.parse(localBal); } catch {}
      }
      if (localPos) {
        try { curPos = JSON.parse(localPos); } catch {}
      }
      if (localOrd) {
        try { curOrd = JSON.parse(localOrd); } catch {}
      }

      // Clean local positions immediately (auto-delete past expired options/MIS, auto-settle today's expiry)
      const cleanedLocal = cleanAndSettlePositions(curPos, curBal);
      curPos = cleanedLocal.cleanPositions;
      curBal = cleanedLocal.newBalance;

      if (isCancelled) return;

      setBalance(curBal);
      setPositions(curPos);
      setOrders(curOrd);

      // 2. Fetch latest synced data from Cloud Upstash Redis
      if (cleanUser) {
        try {
          const res = await fetch(`/api/user/trades?userId=${encodeURIComponent(cleanUser)}`);
          if (res.ok && !isCancelled) {
            const data = await res.json();
            let cloudBal = data.balance !== undefined ? data.balance : curBal;

            if (data.positions && Array.isArray(data.positions)) {
              const mappedPos = data.positions.map((p: Position) => {
                if (p.segment === 'OPTION' && p.contractDetails && (!p.contractDetails.expiryDate || p.contractDetails.expiryDate === 'CURRENT')) {
                  return {
                    ...p,
                    contractDetails: {
                      ...p.contractDetails,
                      expiryDate: getDefaultExpiry(p.symbol)
                    }
                  };
                }
                return p;
              });

              // Clean and settle cloud positions immediately
              const cleanedCloud = cleanAndSettlePositions(mappedPos, cloudBal);
              curPos = cleanedCloud.cleanPositions;
              curBal = cleanedCloud.newBalance;

              setPositions(curPos);
              setBalance(curBal);
              localStorage.setItem(positionsKey, JSON.stringify(curPos));
              localStorage.setItem(balanceKey, JSON.stringify(curBal));

              // If expired positions were purged or settled from cloud, sync clean state to cloud
              if (cleanedCloud.changed) {
                fetch('/api/user/trades', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: cleanUser,
                    balance: curBal,
                    positions: curPos,
                    orders: curOrd,
                  }),
                }).catch(() => {});
              }
            } else if (data.balance !== undefined) {
              curBal = data.balance;
              setBalance(data.balance);
              localStorage.setItem(balanceKey, JSON.stringify(data.balance));
            }

            if (data.orders && Array.isArray(data.orders)) {
              const validOrd = data.orders.filter((o: Order) => isToday(o.timestamp));
              curOrd = validOrd;
              setOrders(validOrd);
              localStorage.setItem(ordersKey, JSON.stringify(validOrd));
            }
          }
        } catch (e) {
          console.error('Failed to sync from cloud Redis', e);
        }
      }

      if (!isCancelled) {
        loadedForUserRef.current = targetUser;
        // Seed the hash so initial load doesn't trigger an immediate redundant save back to Redis
        lastSavedHashRef.current = JSON.stringify({
          bal: curBal,
          posCount: curPos.length,
          pos: curPos.map(p => `${p.id}:${p.quantity}:${p.status}:${p.averagePrice}`),
          ordCount: curOrd.length,
          ord: curOrd.map(o => `${o.id}:${o.status}`)
        });

        setIsLoaded(true);

        setTimeout(() => {
          if (!isCancelled) {
            isInitialSyncDoneRef.current = true;
          }
        }, 150);
      }
    }

    loadTrades();

    return () => {
      isCancelled = true;
    };
  }, [cleanUser, isAuthReady]);

  // Save to localStorage & Cloud Redis when trade state changes
  useEffect(() => {
    const targetUser = cleanUser || '__guest__';

    // STRICT SAFETY GUARDS:
    // 1. Must be loaded
    // 2. Initial sync must be complete
    // 3. Current memory state must belong to the active user (prevents wiping on user switch)
    if (!isLoaded || !isInitialSyncDoneRef.current || loadedForUserRef.current !== targetUser) {
      return;
    }

    try {
      const balanceKey = getStorageKey('balance', cleanUser);
      const positionsKey = getStorageKey('positions', cleanUser);
      const ordersKey = getStorageKey('orders', cleanUser);

      // Always update localStorage
      localStorage.setItem(balanceKey, JSON.stringify(balance));
      localStorage.setItem(positionsKey, JSON.stringify(positions));
      localStorage.setItem(ordersKey, JSON.stringify(orders));

      // Calculate structural fingerprint (only push to Cloud Redis when orders/positions/balance actually change)
      const currentHash = JSON.stringify({
        bal: balance,
        posCount: positions.length,
        pos: positions.map(p => `${p.id}:${p.quantity}:${p.status}:${p.averagePrice}`),
        ordCount: orders.length,
        ord: orders.map(o => `${o.id}:${o.status}`)
      });

      if (currentHash !== lastSavedHashRef.current) {
        lastSavedHashRef.current = currentHash;

        if (cleanUser) {
          fetch('/api/user/trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: cleanUser,
              balance,
              positions,
              orders,
            }),
          }).catch(err => console.error('Cloud Redis save error', err));
        }
      }
    } catch (e) {
      console.error('Failed to save trades', e);
    }
  }, [balance, positions, orders, isLoaded, cleanUser]);

  // Periodic Expiry & Midnight Auto-Pruning Check (every 10 seconds)
  useEffect(() => {
    const pruneInterval = setInterval(() => {
      setPositions(prev => {
        const cleaned = cleanAndSettlePositions(prev, balance);
        if (cleaned.changed) {
          if (cleaned.newBalance !== balance) {
            setBalance(cleaned.newBalance);
          }
          return cleaned.cleanPositions;
        }
        return prev;
      });

      setOrders(prev => prev.filter(o => isToday(o.timestamp)));
    }, 10000); // Check every 10 seconds

    return () => clearInterval(pruneInterval);
  }, [balance]);

  // Calculate required margin for an order
  const calculateMargin = useCallback((params: TradeOrderParams): number => {
    const totalValue = params.quantity * params.price;

    if (params.segment === 'EQUITY') {
      if (params.product === 'INTRADAY') {
        return totalValue * 0.2; // 5x leverage on Intraday equity (20% margin)
      }
      return totalValue; // 100% for delivery CNC
    }

    if (params.segment === 'OPTION') {
      if (params.side === 'BUY') {
        return totalValue; // Option buyers pay 100% premium
      }
      // Option writing margin (~15% of strike/spot value)
      const strike = params.contractDetails?.strikePrice || params.price;
      return params.quantity * strike * 0.15;
    }

    if (params.segment === 'FUTURE') {
      return totalValue * 0.15; // 15% SPAN+Exposure margin for futures
    }

    return totalValue;
  }, []);

  // Reset paper trading account
  const resetAccount = useCallback(() => {
    setBalance(INITIAL_DEMO_CAPITAL);
    setPositions([]);
    setOrders([]);
    try {
      localStorage.removeItem(getStorageKey('balance', cleanUser));
      localStorage.removeItem(getStorageKey('positions', cleanUser));
      localStorage.removeItem(getStorageKey('orders', cleanUser));
    } catch {}
    if (cleanUser) {
      fetch('/api/user/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cleanUser,
          balance: INITIAL_DEMO_CAPITAL,
          positions: [],
          orders: [],
        }),
      }).catch(err => console.error('Cloud Redis reset error', err));
    }
  }, [cleanUser]);

  // Execute an order
  const placeOrder = useCallback((params: TradeOrderParams): { success: boolean; message: string } => {
    const requiredMargin = calculateMargin(params);

    // Require sufficient available margin for both BUY and SELL
    if (requiredMargin > balance) {
      return {
        success: false,
        message: `Insufficient margin! Required: ₹${requiredMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}, Available: ₹${balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
      };
    }

    const orderId = 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const isMarket = params.type === 'MARKET';

    const newOrder: Order = {
      id: orderId,
      timestamp: Date.now(),
      symbol: params.symbol,
      name: params.name,
      segment: params.segment,
      side: params.side,
      product: params.product,
      type: params.type,
      quantity: params.quantity,
      price: params.price,
      triggerPrice: params.triggerPrice,
      status: isMarket ? 'EXECUTED' : 'PENDING',
      filledPrice: isMarket ? params.price : undefined,
      filledTimestamp: isMarket ? Date.now() : undefined,
      contractDetails: params.contractDetails,
    };

    setOrders(prev => [newOrder, ...prev]);

    if (!isMarket) {
      return { success: true, message: `Limit Order placed successfully for ${params.symbol} at ₹${params.price}` };
    }

    setPositions(prev => {
      // Find matching open position by symbol, segment, product, and contract details
      const existingIdx = prev.findIndex(p => {
        if (p.status === 'CLOSED') return false; // Only match active open positions
        const sameSym = p.symbol === params.symbol && p.segment === params.segment && p.product === params.product;
        if (!sameSym) return false;
        if (params.segment === 'OPTION') {
          return p.contractDetails?.strikePrice === params.contractDetails?.strikePrice &&
                 p.contractDetails?.optionType === params.contractDetails?.optionType &&
                 p.contractDetails?.expiryDate === params.contractDetails?.expiryDate;
        }
        return true;
      });

      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const updated = [...prev];

        if (existing.side === params.side) {
          // Adding to existing position: Block additional requiredMargin from available cash
          setBalance(b => b - requiredMargin);

          const totalQty = existing.quantity + params.quantity;
          const newAvgPrice = (existing.averagePrice * existing.quantity + params.price * params.quantity) / totalQty;
          const newMargin = existing.marginUsed + requiredMargin;

          updated[existingIdx] = {
            ...existing,
            quantity: totalQty,
            averagePrice: Math.round(newAvgPrice * 100) / 100,
            marginUsed: newMargin,
          };
          return updated;
        } else {
          // Reducing or exiting position (opposite side order)
          if (params.quantity <= existing.quantity) {
            const diffQty = existing.quantity - params.quantity;
            const realizedTradePnL = existing.side === 'BUY'
              ? (params.price - existing.averagePrice) * params.quantity
              : (existing.averagePrice - params.price) * params.quantity;

            const ratio = params.quantity / existing.quantity;
            const releasedMargin = existing.marginUsed * ratio;

            // Refund blocked margin for the exited portion + realized P&L
            setBalance(b => b + releasedMargin + realizedTradePnL);

            if (diffQty === 0) {
              // Full exit: Mark as CLOSED
              updated[existingIdx] = {
                ...existing,
                quantity: 0,
                status: 'CLOSED',
                closedAt: Date.now(),
                exitPrice: params.price,
                realizedPnL: existing.realizedPnL + realizedTradePnL,
                unrealizedPnL: 0,
                unrealizedPnLPerc: 0,
                marginUsed: 0,
              };
              return updated;
            } else {
              // Partial exit: Keep remaining quantity and margin
              updated[existingIdx] = {
                ...existing,
                quantity: diffQty,
                realizedPnL: existing.realizedPnL + realizedTradePnL,
                marginUsed: existing.marginUsed - releasedMargin,
              };
              return updated;
            }
          } else {
            // Flipped to opposite side: Close existing, open excess
            const excessQty = params.quantity - existing.quantity;
            const realizedTradePnL = existing.side === 'BUY'
              ? (params.price - existing.averagePrice) * existing.quantity
              : (existing.averagePrice - params.price) * existing.quantity;

            const newMargin = calculateMargin({ ...params, quantity: excessQty });

            // Refund closed position margin & P&L, and block newMargin for the excess portion
            setBalance(b => b + existing.marginUsed + realizedTradePnL - newMargin);

            // Close existing position
            const closedPos: Position = {
              ...existing,
              quantity: 0,
              status: 'CLOSED',
              closedAt: Date.now(),
              exitPrice: params.price,
              realizedPnL: existing.realizedPnL + realizedTradePnL,
              unrealizedPnL: 0,
              unrealizedPnLPerc: 0,
              marginUsed: 0,
            };

            const newPos: Position = {
              id: 'POS-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              symbol: params.symbol,
              name: params.name,
              segment: params.segment,
              side: params.side,
              product: params.product,
              quantity: excessQty,
              averagePrice: params.price,
              currentPrice: params.price,
              unrealizedPnL: 0,
              unrealizedPnLPerc: 0,
              realizedPnL: 0,
              marginUsed: newMargin,
              openedAt: Date.now(),
              status: 'OPEN',
              contractDetails: params.contractDetails,
            };

            return [newPos, closedPos, ...prev.filter((_, idx) => idx !== existingIdx)];
          }
        }
      } else {
        // Brand new position: Block requiredMargin from available cash
        setBalance(b => b - requiredMargin);

        const newPos: Position = {
          id: 'POS-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
          symbol: params.symbol,
          name: params.name,
          segment: params.segment,
          side: params.side,
          product: params.product,
          quantity: params.quantity,
          averagePrice: params.price,
          currentPrice: params.price,
          unrealizedPnL: 0,
          unrealizedPnLPerc: 0,
          realizedPnL: 0,
          marginUsed: requiredMargin,
          openedAt: Date.now(),
          status: 'OPEN',
          contractDetails: params.contractDetails,
        };
        return [newPos, ...prev];
      }
    });

    return {
      success: true,
      message: `${params.side} ${params.quantity} ${params.contractDetails?.optionType ? params.contractDetails.optionType : ''} of ${params.symbol} executed at ₹${params.price}`
    };
  }, [balance, calculateMargin]);

  // Update positions with live market prices (only open, non-expired positions)
  const updatePrices = useCallback((priceMap: Record<string, number>) => {
    setPositions(prev => {
      let hasChanges = false;
      const updated = prev.map(p => {
        // Don't update prices for closed or expired positions
        if (p.status === 'CLOSED' || isOptionExpired(p.contractDetails?.expiryDate)) return p;

        let currentLtp = p.currentPrice;

        // Check if matching key in priceMap
        if (p.id && priceMap[p.id]) {
          currentLtp = priceMap[p.id];
        } else if (p.segment === 'EQUITY') {
          if (priceMap[p.symbol]) currentLtp = priceMap[p.symbol];
        } else if (p.segment === 'OPTION' && p.contractDetails) {
          const optKey = `${p.symbol}_${p.contractDetails.strikePrice}_${p.contractDetails.optionType}`;
          if (priceMap[optKey]) currentLtp = priceMap[optKey];
        } else if (p.segment === 'FUTURE') {
          if (priceMap[p.symbol + '_FUT']) currentLtp = priceMap[p.symbol + '_FUT'];
          else if (priceMap[p.symbol]) currentLtp = priceMap[p.symbol] * 1.002;
        }

        if (currentLtp !== p.currentPrice) {
          hasChanges = true;
          const unrealizedPnL = p.side === 'BUY'
            ? (currentLtp - p.averagePrice) * p.quantity
            : (p.averagePrice - currentLtp) * p.quantity;
          const cost = p.averagePrice * p.quantity;
          const unrealizedPnLPerc = cost > 0 ? (unrealizedPnL / cost) * 100 : 0;

          return {
            ...p,
            currentPrice: currentLtp,
            unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
            unrealizedPnLPerc: Math.round(unrealizedPnLPerc * 100) / 100,
          };
        }
        return p;
      });

      return hasChanges ? updated : prev;
    });

    // Check pending orders for triggers
    setOrders(prev => {
      let updatedOrders = [...prev];
      let triggered = false;

      updatedOrders = updatedOrders.map(order => {
        if (order.status !== 'PENDING') return order;
        const ltp = priceMap[order.symbol] || order.price;

        if (order.type === 'LIMIT') {
          if ((order.side === 'BUY' && ltp <= order.price) || (order.side === 'SELL' && ltp >= order.price)) {
            triggered = true;
            return {
              ...order,
              status: 'EXECUTED' as const,
              filledPrice: order.price,
              filledTimestamp: Date.now()
            };
          }
        }
        return order;
      });

      return triggered ? updatedOrders : prev;
    });
  }, []);

  // Exit an individual position
  const closePosition = useCallback((positionId: string) => {
    setPositions(prev => {
      const posIdx = prev.findIndex(p => p.id === positionId);
      if (posIdx === -1) return prev;

      const pos = prev[posIdx];
      if (pos.status === 'CLOSED') return prev;

      const exitPnL = pos.unrealizedPnL;
      // Refund margin + PnL
      setBalance(b => b + pos.marginUsed + exitPnL);

      // Record closing order
      const closeOrder: Order = {
        id: 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        timestamp: Date.now(),
        symbol: pos.symbol,
        name: pos.name,
        segment: pos.segment,
        side: pos.side === 'BUY' ? 'SELL' : 'BUY',
        product: pos.product,
        type: 'MARKET',
        quantity: pos.quantity,
        price: pos.currentPrice,
        status: 'EXECUTED',
        filledPrice: pos.currentPrice,
        filledTimestamp: Date.now(),
        contractDetails: pos.contractDetails
      };
      setOrders(o => [closeOrder, ...o]);

      // Keep in positions array as CLOSED showing realized P&L for today
      const updated = [...prev];
      updated[posIdx] = {
        ...pos,
        status: 'CLOSED',
        closedAt: Date.now(),
        exitPrice: pos.currentPrice,
        realizedPnL: exitPnL,
        unrealizedPnL: 0,
        unrealizedPnLPerc: 0,
        marginUsed: 0,
      };
      return updated;
    });
  }, []);

  // Exit all open positions at market price
  const closeAllPositions = useCallback(() => {
    positions.filter(p => p.status !== 'CLOSED').forEach(p => closePosition(p.id));
  }, [positions, closePosition]);

  // Directly delete an individual position and refund its margin
  const deletePosition = useCallback((positionId: string) => {
    setPositions(prev => {
      const pos = prev.find(p => p.id === positionId);
      if (pos && pos.status !== 'CLOSED' && pos.marginUsed > 0) {
        setBalance(b => b + pos.marginUsed);
      }
      return prev.filter(p => p.id !== positionId);
    });
  }, []);

  // Clear all expired options and past-day intraday positions immediately
  const clearExpiredPositions = useCallback(() => {
    setPositions(prev => {
      const cleaned = cleanAndSettlePositions(prev, balance);
      if (cleaned.newBalance !== balance) {
        setBalance(cleaned.newBalance);
      }
      return cleaned.cleanPositions;
    });
  }, [balance]);

  // Cancel pending order
  const cancelOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
  }, []);

  // Calculate portfolio totals
  const openPositions = positions.filter(p => p.status !== 'CLOSED');
  const closedPositions = positions.filter(p => p.status === 'CLOSED');

  const totalUnrealizedPnL = openPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
  const totalRealizedPnL = closedPositions.reduce((acc, p) => acc + (p.realizedPnL || 0), 0);
  const totalUsedMargin = openPositions.reduce((acc, p) => acc + p.marginUsed, 0);
  const totalAccountValue = balance + totalUsedMargin + totalUnrealizedPnL;
  const netPnL = totalRealizedPnL + totalUnrealizedPnL;

  const portfolio: PortfolioSummary = {
    startingBalance: INITIAL_DEMO_CAPITAL,
    availableCash: balance,
    usedMargin: totalUsedMargin,
    totalAccountValue: Math.round(totalAccountValue * 100) / 100,
    totalUnrealizedPnL: Math.round(totalUnrealizedPnL * 100) / 100,
    totalRealizedPnL: Math.round(totalRealizedPnL * 100) / 100,
    netPnL: Math.round(netPnL * 100) / 100,
  };

  return {
    balance,
    positions,
    orders,
    portfolio,
    placeOrder,
    closePosition,
    closeAllPositions,
    deletePosition,
    clearExpiredPositions,
    cancelOrder,
    updatePrices,
    resetAccount,
    calculateMargin,
  };
}
