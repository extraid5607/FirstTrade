'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order, Position, PortfolioSummary, OrderSide, OrderProduct, OrderType, TradingSegment } from '@/types/trading';
import { INITIAL_DEMO_CAPITAL, getDefaultExpiry } from '@/lib/constants';

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

export function useTradeStore(userId?: string) {
  const cleanUser = userId ? userId.trim().toLowerCase() : undefined;

  const [balance, setBalance] = useState<number>(INITIAL_DEMO_CAPITAL);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from Cloud Redis (with localStorage immediate cache) when user changes
  useEffect(() => {
    setIsLoaded(false);
    let isCancelled = false;

    async function loadTrades() {
      // 1. Immediate local cache fallback
      const balanceKey = getStorageKey('balance', cleanUser);
      const positionsKey = getStorageKey('positions', cleanUser);
      const ordersKey = getStorageKey('orders', cleanUser);

      const localBal = localStorage.getItem(balanceKey);
      const localPos = localStorage.getItem(positionsKey);
      const localOrd = localStorage.getItem(ordersKey);

      if (localBal) {
        setBalance(JSON.parse(localBal));
      } else {
        setBalance(INITIAL_DEMO_CAPITAL);
      }

      if (localPos) {
        setPositions(JSON.parse(localPos));
      } else {
        setPositions([]);
      }

      if (localOrd) {
        setOrders(JSON.parse(localOrd));
      } else {
        setOrders([]);
      }

      // 2. Fetch latest synced data from Cloud Upstash Redis
      if (cleanUser) {
        try {
          const res = await fetch(`/api/user/trades?userId=${encodeURIComponent(cleanUser)}`);
          if (res.ok && !isCancelled) {
            const data = await res.json();
            if (data.balance !== undefined) {
              setBalance(data.balance);
              localStorage.setItem(balanceKey, JSON.stringify(data.balance));
            }
            if (data.positions) {
              const validPos = data.positions.filter((p: Position) => {
                if (p.status === 'CLOSED') return isToday(p.closedAt || p.openedAt);
                return true;
              }).map((p: Position) => {
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
              setPositions(validPos);
              localStorage.setItem(positionsKey, JSON.stringify(validPos));
            }
            if (data.orders) {
              const validOrd = data.orders.filter((o: Order) => isToday(o.timestamp));
              setOrders(validOrd);
              localStorage.setItem(ordersKey, JSON.stringify(validOrd));
            }
          }
        } catch (e) {
          console.error('Failed to sync from cloud Redis', e);
        }
      }

      if (!isCancelled) {
        setIsLoaded(true);
      }
    }

    loadTrades();

    return () => {
      isCancelled = true;
    };
  }, [cleanUser]);

  // Save to localStorage & Cloud Redis when state changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const balanceKey = getStorageKey('balance', cleanUser);
      const positionsKey = getStorageKey('positions', cleanUser);
      const ordersKey = getStorageKey('orders', cleanUser);

      localStorage.setItem(balanceKey, JSON.stringify(balance));
      localStorage.setItem(positionsKey, JSON.stringify(positions));
      localStorage.setItem(ordersKey, JSON.stringify(orders));

      // Push to Cloud Upstash Redis
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
    } catch (e) {
      console.error('Failed to save trades', e);
    }
  }, [balance, positions, orders, isLoaded, cleanUser]);

  // Periodic Midnight (11:59 PM) Pruning Check
  useEffect(() => {
    const midnightInterval = setInterval(() => {
      setPositions(prev => prev.filter(p => {
        if (p.status === 'CLOSED') {
          return isToday(p.closedAt || p.openedAt);
        }
        return true;
      }));

      setOrders(prev => prev.filter(o => isToday(o.timestamp)));
    }, 30000); // Check every 30 seconds

    return () => clearInterval(midnightInterval);
  }, []);

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

    if (params.side === 'BUY' && requiredMargin > balance) {
      return {
        success: false,
        message: `Insufficient margin! Required: ₹${requiredMargin.toLocaleString('en-IN')}, Available: ₹${balance.toLocaleString('en-IN')}`
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

    // Execute immediately and update positions & cash
    setBalance(prev => prev - (params.side === 'BUY' ? requiredMargin : -requiredMargin * 0.5));

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
          // Adding to existing side
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
          // Reducing or exiting position
          if (params.quantity <= existing.quantity) {
            const diffQty = existing.quantity - params.quantity;
            const realizedTradePnL = existing.side === 'BUY'
              ? (params.price - existing.averagePrice) * params.quantity
              : (existing.averagePrice - params.price) * params.quantity;

            // Refund cash balance
            setBalance(b => b + (existing.marginUsed * (params.quantity / existing.quantity)) + realizedTradePnL);

            if (diffQty === 0) {
              // Mark as CLOSED rather than removing so PnL stays visible for today
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
              updated[existingIdx] = {
                ...existing,
                quantity: diffQty,
                realizedPnL: existing.realizedPnL + realizedTradePnL,
                marginUsed: existing.marginUsed * (diffQty / existing.quantity),
              };
              return updated;
            }
          } else {
            // Flipped to opposite side
            const excessQty = params.quantity - existing.quantity;
            const realizedTradePnL = existing.side === 'BUY'
              ? (params.price - existing.averagePrice) * existing.quantity
              : (existing.averagePrice - params.price) * existing.quantity;

            setBalance(b => b + existing.marginUsed + realizedTradePnL);

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
              marginUsed: calculateMargin({ ...params, quantity: excessQty }),
              openedAt: Date.now(),
              status: 'OPEN',
              contractDetails: params.contractDetails,
            };

            return [newPos, closedPos, ...prev.filter((_, idx) => idx !== existingIdx)];
          }
        }
      } else {
        // Create new position
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

  // Update positions with live market prices (only open positions)
  const updatePrices = useCallback((priceMap: Record<string, number>) => {
    setPositions(prev => {
      let hasChanges = false;
      const updated = prev.map(p => {
        // Don't update prices for closed positions
        if (p.status === 'CLOSED') return p;

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
    cancelOrder,
    updatePrices,
    resetAccount,
    calculateMargin,
  };
}
