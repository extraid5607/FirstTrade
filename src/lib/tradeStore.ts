'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Order, Position, PortfolioSummary, OrderSide, OrderProduct, OrderType, TradingSegment, TradeOrderParams } from '@/types/trading';
import { INITIAL_DEMO_CAPITAL, getDefaultExpiry } from '@/lib/constants';
import { cleanAndSettlePositions, isOptionExpired } from '@/lib/expiry';
import {
  calculatePortfolioMargin,
  calculateOrderMarginRequirement,
  isSameContract,
} from '@/lib/marginEngine';

const getStorageKey = (key: string, userId?: string) => {
  if (!userId) return `first_trade_guest_${key}`;
  return `first_trade_${userId.trim().toLowerCase()}_${key}`;
};

export type { TradeOrderParams };

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

  // Base capital state (Initial virtual trading capital, default ₹10,00,000)
  const [baseCapital, setBaseCapital] = useState<number>(INITIAL_DEMO_CAPITAL);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // References to guarantee no race-conditions or accidental state wiping
  const loadedForUserRef = useRef<string | null>(null);
  const isInitialSyncDoneRef = useRef(false);
  const lastSavedHashRef = useRef<string>('');

  // -------------------------------------------------------------
  // Load from Cloud Redis (with localStorage immediate cache)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isAuthReady) return;

    let isCancelled = false;
    loadedForUserRef.current = null;
    isInitialSyncDoneRef.current = false;
    setIsLoaded(false);

    async function loadTrades() {
      const targetUser = cleanUser || '__guest__';
      const baseCapitalKey = getStorageKey('baseCapital', cleanUser);
      const positionsKey = getStorageKey('positions', cleanUser);
      const ordersKey = getStorageKey('orders', cleanUser);

      // 1. Immediate local cache retrieval
      let curBaseCapital = INITIAL_DEMO_CAPITAL;
      let curPos: Position[] = [];
      let curOrd: Order[] = [];

      const localBaseCap = localStorage.getItem(baseCapitalKey);
      const localPos = localStorage.getItem(positionsKey);
      const localOrd = localStorage.getItem(ordersKey);

      if (localBaseCap) {
        try {
          const parsed = JSON.parse(localBaseCap);
          if (typeof parsed === 'number' && !isNaN(parsed) && parsed > 0) {
            curBaseCapital = parsed;
          }
        } catch {}
      }

      if (localPos) {
        try { curPos = JSON.parse(localPos); } catch {}
      }
      if (localOrd) {
        try { curOrd = JSON.parse(localOrd); } catch {}
      }

      // Clean local positions immediately (auto-delete past expired options/MIS, auto-settle today's expiry)
      const cleanedLocal = cleanAndSettlePositions(curPos, curBaseCapital);
      curPos = cleanedLocal.cleanPositions;

      // Synchronize portfolio margins and hedge tags on open positions
      const localOpen = curPos.filter(p => p.status !== 'CLOSED');
      const localMarginRes = calculatePortfolioMargin(localOpen);
      curPos = curPos.map(p => {
        if (p.status === 'CLOSED') return p;
        return {
          ...p,
          marginUsed: localMarginRes.positionMargins[p.id] !== undefined ? localMarginRes.positionMargins[p.id] : p.marginUsed,
          isHedged: localMarginRes.hedgedLegIds.has(p.id),
          hedgeBenefit: localMarginRes.hedgeNotes[p.id],
        };
      });

      if (isCancelled) return;

      setBaseCapital(curBaseCapital);
      setPositions(curPos);
      setOrders(curOrd);

      // 2. Fetch latest synced data from Cloud Upstash Redis
      if (cleanUser) {
        try {
          const res = await fetch(`/api/user/trades?userId=${encodeURIComponent(cleanUser)}`);
          if (res.ok && !isCancelled) {
            const data = await res.json();
            
            if (data.baseCapital !== undefined && typeof data.baseCapital === 'number' && data.baseCapital > 0) {
              curBaseCapital = data.baseCapital;
            } else {
              curBaseCapital = INITIAL_DEMO_CAPITAL;
            }

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
              const cleanedCloud = cleanAndSettlePositions(mappedPos, curBaseCapital);
              curPos = cleanedCloud.cleanPositions;

              // Synchronize portfolio margin with real SEBI/Broker SPAN + Exposure
              const cloudOpen = curPos.filter(p => p.status !== 'CLOSED');
              const cloudMarginRes = calculatePortfolioMargin(cloudOpen);
              curPos = curPos.map(p => {
                if (p.status === 'CLOSED') return p;
                return {
                  ...p,
                  marginUsed: cloudMarginRes.positionMargins[p.id] !== undefined ? cloudMarginRes.positionMargins[p.id] : p.marginUsed,
                  isHedged: cloudMarginRes.hedgedLegIds.has(p.id),
                  hedgeBenefit: cloudMarginRes.hedgeNotes[p.id],
                };
              });

              setPositions(curPos);
              setBaseCapital(curBaseCapital);
              localStorage.setItem(positionsKey, JSON.stringify(curPos));
              localStorage.setItem(baseCapitalKey, JSON.stringify(curBaseCapital));

              // If expired positions were purged or margins rebalanced, sync clean state to cloud
              if (cleanedCloud.changed) {
                fetch('/api/user/trades', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: cleanUser,
                    baseCapital: curBaseCapital,
                    positions: curPos,
                    orders: curOrd,
                  }),
                }).catch(() => {});
              }
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
          baseCap: curBaseCapital,
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

  // -------------------------------------------------------------
  // Mathematical Portfolio & Funds Derivation (Real Broker Standard)
  // Available Margin = Base Capital + Realized P&L - Used Margin
  // -------------------------------------------------------------
  const openPositions = useMemo(() => positions.filter(p => p.status !== 'CLOSED'), [positions]);
  const closedPositions = useMemo(() => positions.filter(p => p.status === 'CLOSED'), [positions]);

  const totalRealizedPnL = useMemo(() => {
    return Math.round(closedPositions.reduce((acc, p) => acc + (p.realizedPnL || 0), 0) * 100) / 100;
  }, [closedPositions]);

  const totalUnrealizedPnL = useMemo(() => {
    return Math.round(openPositions.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0) * 100) / 100;
  }, [openPositions]);

  const portfolioMarginRes = useMemo(() => {
    return calculatePortfolioMargin(openPositions);
  }, [openPositions]);

  const totalUsedMargin = portfolioMarginRes.totalMargin;

  // Net Cash Balance = Starting Demo Capital + All Realized P&L
  const totalCash = Math.round((baseCapital + totalRealizedPnL) * 100) / 100;

  // Available Cash for placing new trades = Total Cash - Margin Blocked on Open Positions
  const availableCash = Math.max(0, Math.round((totalCash - totalUsedMargin) * 100) / 100);

  // Total Account Value (Net Demo Equity) = Total Cash + Total Unrealized P&L
  const totalAccountValue = Math.round((totalCash + totalUnrealizedPnL) * 100) / 100;

  // Total Today P&L = Realized + Unrealized
  const netPnL = Math.round((totalRealizedPnL + totalUnrealizedPnL) * 100) / 100;

  const portfolio: PortfolioSummary = {
    startingBalance: baseCapital,
    availableCash,
    usedMargin: totalUsedMargin,
    totalAccountValue,
    totalUnrealizedPnL,
    totalRealizedPnL,
    netPnL,
  };

  // -------------------------------------------------------------
  // Save to localStorage & Cloud Redis when trade state changes
  // -------------------------------------------------------------
  useEffect(() => {
    const targetUser = cleanUser || '__guest__';

    // Safety guards: Must be loaded, initial sync complete, and state belongs to active user
    if (!isLoaded || !isInitialSyncDoneRef.current || loadedForUserRef.current !== targetUser) {
      return;
    }

    try {
      const balanceKey = getStorageKey('balance', cleanUser);
      const baseCapitalKey = getStorageKey('baseCapital', cleanUser);
      const positionsKey = getStorageKey('positions', cleanUser);
      const ordersKey = getStorageKey('orders', cleanUser);

      // Always update localStorage
      localStorage.setItem(balanceKey, JSON.stringify(availableCash));
      localStorage.setItem(baseCapitalKey, JSON.stringify(baseCapital));
      localStorage.setItem(positionsKey, JSON.stringify(positions));
      localStorage.setItem(ordersKey, JSON.stringify(orders));

      // Structural fingerprint (only push to Cloud Redis when orders/positions/capital actually change)
      const currentHash = JSON.stringify({
        baseCap: baseCapital,
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
              balance: availableCash,
              baseCapital,
              positions,
              orders,
            }),
          }).catch(err => console.error('Cloud Redis save error', err));
        }
      }
    } catch (e) {
      console.error('Failed to save trades', e);
    }
  }, [baseCapital, availableCash, positions, orders, isLoaded, cleanUser]);

  // -------------------------------------------------------------
  // Periodic Expiry & Midnight Auto-Pruning Check (every 10 seconds)
  // -------------------------------------------------------------
  useEffect(() => {
    const pruneInterval = setInterval(() => {
      setPositions(prev => {
        const cleaned = cleanAndSettlePositions(prev, baseCapital);
        if (cleaned.changed) {
          return cleaned.cleanPositions;
        }
        return prev;
      });

      setOrders(prev => prev.filter(o => isToday(o.timestamp)));
    }, 10000);

    return () => clearInterval(pruneInterval);
  }, [baseCapital]);

  // Calculate required margin for an order considering existing portfolio hedges
  const calculateMargin = useCallback((params: TradeOrderParams): number => {
    return calculateOrderMarginRequirement(positions, params).requiredMargin;
  }, [positions]);

  // Reset paper trading account back to ₹10 Lakhs cleanly
  const resetAccount = useCallback(() => {
    setBaseCapital(INITIAL_DEMO_CAPITAL);
    setPositions([]);
    setOrders([]);
    try {
      localStorage.removeItem(getStorageKey('balance', cleanUser));
      localStorage.removeItem(getStorageKey('baseCapital', cleanUser));
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
          baseCapital: INITIAL_DEMO_CAPITAL,
          positions: [],
          orders: [],
        }),
      }).catch(err => console.error('Cloud Redis reset error', err));
    }
  }, [cleanUser]);

  // -------------------------------------------------------------
  // Execute an order
  // -------------------------------------------------------------
  const placeOrder = useCallback((params: TradeOrderParams): { success: boolean; message: string } => {
    const marginCheck = calculateOrderMarginRequirement(positions, params);
    const requiredMargin = marginCheck.requiredMargin;

    // Require sufficient available margin only for new/increasing risk orders (never block exit orders!)
    if (!marginCheck.isExit && requiredMargin > availableCash) {
      return {
        success: false,
        message: `Insufficient margin! Required: ₹${requiredMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}, Available: ₹${availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
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
      // Find matching open position by contract details
      const existingIdx = prev.findIndex(p => p.status !== 'CLOSED' && isSameContract(p, params));
      let nextPositions: Position[] = [...prev];

      if (existingIdx >= 0) {
        const existing = prev[existingIdx];

        if (existing.side === params.side) {
          // Adding to existing position: increase quantity and compute weighted average price
          const totalQty = existing.quantity + params.quantity;
          const newAvgPrice = (existing.averagePrice * existing.quantity + params.price * params.quantity) / totalQty;

          nextPositions[existingIdx] = {
            ...existing,
            quantity: totalQty,
            averagePrice: Math.round(newAvgPrice * 100) / 100,
          };
        } else {
          // Reducing or exiting position (opposite side order)
          if (params.quantity <= existing.quantity) {
            const diffQty = existing.quantity - params.quantity;
            const realizedTradePnL = existing.side === 'BUY'
              ? (params.price - existing.averagePrice) * params.quantity
              : (existing.averagePrice - params.price) * params.quantity;

            if (diffQty === 0) {
              // Full exit: Mark as CLOSED
              nextPositions[existingIdx] = {
                ...existing,
                quantity: 0,
                status: 'CLOSED',
                closedAt: Date.now(),
                exitPrice: params.price,
                realizedPnL: existing.realizedPnL + realizedTradePnL,
                unrealizedPnL: 0,
                unrealizedPnLPerc: 0,
                marginUsed: 0,
                isHedged: false,
              };
            } else {
              // Partial exit: Keep remaining quantity
              nextPositions[existingIdx] = {
                ...existing,
                quantity: diffQty,
                realizedPnL: existing.realizedPnL + realizedTradePnL,
              };
            }
          } else {
            // Flipped to opposite side: Close existing, open excess
            const excessQty = params.quantity - existing.quantity;
            const realizedTradePnL = existing.side === 'BUY'
              ? (params.price - existing.averagePrice) * existing.quantity
              : (existing.averagePrice - params.price) * existing.quantity;

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
              isHedged: false,
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
              marginUsed: 0,
              openedAt: Date.now(),
              status: 'OPEN',
              contractDetails: params.contractDetails,
            };

            nextPositions = [newPos, closedPos, ...prev.filter((_, idx) => idx !== existingIdx)];
          }
        }
      } else {
        // Brand new position
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
          marginUsed: 0,
          openedAt: Date.now(),
          status: 'OPEN',
          contractDetails: params.contractDetails,
        };
        nextPositions = [newPos, ...prev];
      }

      // Calculate portfolio margin for remaining open positions
      const newOpenPositions = nextPositions.filter(p => p.status !== 'CLOSED');
      const newMarginRes = calculatePortfolioMargin(newOpenPositions);

      // Update marginUsed and hedge benefit flags on all open positions
      return nextPositions.map(p => {
        if (p.status === 'CLOSED') {
          return { ...p, marginUsed: 0, isHedged: false };
        }
        return {
          ...p,
          marginUsed: newMarginRes.positionMargins[p.id] !== undefined ? newMarginRes.positionMargins[p.id] : p.marginUsed,
          isHedged: newMarginRes.hedgedLegIds.has(p.id),
          hedgeBenefit: newMarginRes.hedgeNotes[p.id],
        };
      });
    });

    return {
      success: true,
      message: `${params.side} ${params.quantity} ${params.contractDetails?.optionType ? params.contractDetails.optionType : ''} of ${params.symbol} executed at ₹${params.price}`
    };
  }, [availableCash, positions]);

  // -------------------------------------------------------------
  // Update positions with live market prices (only open, non-expired positions)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Exit an individual position
  // -------------------------------------------------------------
  const closePosition = useCallback((positionId: string) => {
    setPositions(prev => {
      const posIdx = prev.findIndex(p => p.id === positionId);
      if (posIdx === -1) return prev;

      const pos = prev[posIdx];
      if (pos.status === 'CLOSED') return prev;

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

      // Mark position as CLOSED
      const exitPnL = pos.unrealizedPnL;
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
        isHedged: false,
      };

      // Calculate portfolio margin for remaining open positions
      const remainingOpen = updated.filter(p => p.status !== 'CLOSED');
      const newMarginRes = calculatePortfolioMargin(remainingOpen);

      // Update remaining positions with their rebalanced margins
      return updated.map(p => {
        if (p.status === 'CLOSED') return p;
        return {
          ...p,
          marginUsed: newMarginRes.positionMargins[p.id] !== undefined ? newMarginRes.positionMargins[p.id] : p.marginUsed,
          isHedged: newMarginRes.hedgedLegIds.has(p.id),
          hedgeBenefit: newMarginRes.hedgeNotes[p.id],
        };
      });
    });
  }, []);

  // -------------------------------------------------------------
  // Exit all open positions at market price atomically
  // -------------------------------------------------------------
  const closeAllPositions = useCallback(() => {
    setPositions(prev => {
      const openPos = prev.filter(p => p.status !== 'CLOSED');
      if (openPos.length === 0) return prev;

      const now = Date.now();
      const newOrders: Order[] = [];

      const updated = prev.map(p => {
        if (p.status === 'CLOSED') return p;

        newOrders.push({
          id: 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
          timestamp: now,
          symbol: p.symbol,
          name: p.name,
          segment: p.segment,
          side: p.side === 'BUY' ? 'SELL' : 'BUY',
          product: p.product,
          type: 'MARKET',
          quantity: p.quantity,
          price: p.currentPrice,
          status: 'EXECUTED',
          filledPrice: p.currentPrice,
          filledTimestamp: now,
          contractDetails: p.contractDetails
        });

        return {
          ...p,
          status: 'CLOSED' as const,
          closedAt: now,
          exitPrice: p.currentPrice,
          realizedPnL: p.unrealizedPnL,
          unrealizedPnL: 0,
          unrealizedPnLPerc: 0,
          marginUsed: 0,
          isHedged: false,
        };
      });

      setOrders(o => [...newOrders, ...o]);
      return updated;
    });
  }, []);

  // Directly delete an individual position
  const deletePosition = useCallback((positionId: string) => {
    setPositions(prev => prev.filter(p => p.id !== positionId));
  }, []);

  // Clear all expired options and past-day intraday positions immediately
  const clearExpiredPositions = useCallback(() => {
    setPositions(prev => {
      const cleaned = cleanAndSettlePositions(prev, baseCapital);
      return cleaned.cleanPositions;
    });
  }, [baseCapital]);

  // Cancel pending order
  const cancelOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
  }, []);

  return {
    balance: availableCash, // Backward-compatible with components expecting balance
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
