import { Position, TradeOrderParams } from '@/types/trading';
import { getExpiryTimestamp } from '@/lib/expiry';

/**
 * Normalizes an expiry string to a comparable timestamp or string
 */
export function normalizeExpiryKey(expiryDate?: string): string {
  if (!expiryDate || expiryDate === 'CURRENT') return 'CURRENT';
  const ts = getExpiryTimestamp(expiryDate);
  if (ts) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return expiryDate.trim().toUpperCase();
}

/**
 * Calculates standalone single-leg margin for an individual order or position
 */
export function calculateStandaloneMargin(item: {
  symbol: string;
  segment: 'EQUITY' | 'FUTURE' | 'OPTION';
  side: 'BUY' | 'SELL';
  product: 'INTRADAY' | 'DELIVERY';
  quantity: number;
  price: number;
  contractDetails?: {
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: string;
  };
}): number {
  const totalValue = item.quantity * item.price;

  if (item.segment === 'EQUITY') {
    if (item.product === 'INTRADAY') {
      return Math.round(totalValue * 0.2 * 100) / 100; // 5x leverage (20% margin)
    }
    return Math.round(totalValue * 100) / 100; // 100% for delivery CNC
  }

  if (item.segment === 'FUTURE') {
    return Math.round(totalValue * 0.15 * 100) / 100; // 15% SPAN+Exposure
  }

  if (item.segment === 'OPTION') {
    if (item.side === 'BUY') {
      return Math.round(totalValue * 100) / 100; // 100% premium paid upfront
    }
    // Option selling margin (standard Indian broker / NSE SPAN: ~12-15% of strike/spot)
    const strike = item.contractDetails?.strikePrice || item.price;
    return Math.round(item.quantity * strike * 0.15 * 100) / 100;
  }

  return Math.round(totalValue * 100) / 100;
}

export interface PortfolioMarginResult {
  totalMargin: number;
  positionMargins: Record<string, number>;
  hedgedLegIds: Set<string>;
  hedgeNotes: Record<string, string>;
}

/**
 * Calculates the total portfolio margin across all open positions with
 * Exchange/Broker standard (NSE SPAN style) hedging and Straddle/Strangle margin benefits:
 * 
 * - When selling both CE and PE of the same underlying (Straddle or Strangle):
 *   Higher margin leg = 100% standalone margin
 *   Opposing short leg = 25% exposure margin (75% margin discount!)
 * 
 * - When holding a long option that hedges a short option (Debit/Credit Spreads):
 *   Short option margin is discounted by 60% due to capped risk.
 */
export function calculatePortfolioMargin(positions: Position[]): PortfolioMarginResult {
  const openPositions = positions.filter(p => p.status !== 'CLOSED' && p.quantity > 0);
  const positionMargins: Record<string, number> = {};
  const hedgedLegIds = new Set<string>();
  const hedgeNotes: Record<string, string> = {};

  // Group by underlying symbol
  const bySymbol: Record<string, Position[]> = {};
  for (const pos of openPositions) {
    if (!bySymbol[pos.symbol]) bySymbol[pos.symbol] = [];
    bySymbol[pos.symbol].push(pos);
  }

  for (const [symbol, symPositions] of Object.entries(bySymbol)) {
    // 1. Handle Non-Option positions first
    for (const pos of symPositions) {
      if (pos.segment !== 'OPTION') {
        const margin = calculateStandaloneMargin({
          symbol: pos.symbol,
          segment: pos.segment,
          side: pos.side,
          product: pos.product,
          quantity: pos.quantity,
          price: pos.averagePrice,
          contractDetails: pos.contractDetails,
        });
        positionMargins[pos.id] = margin;
      }
    }

    // 2. Handle Option positions (grouped by expiry)
    const optionPositions = symPositions.filter(p => p.segment === 'OPTION');
    const byExpiry: Record<string, Position[]> = {};
    for (const pos of optionPositions) {
      const expKey = normalizeExpiryKey(pos.contractDetails?.expiryDate);
      if (!byExpiry[expKey]) byExpiry[expKey] = [];
      byExpiry[expKey].push(pos);
    }

    for (const [_, expPositions] of Object.entries(byExpiry)) {
      const shortCE = expPositions.filter(p => p.side === 'SELL' && p.contractDetails?.optionType === 'CE');
      const shortPE = expPositions.filter(p => p.side === 'SELL' && p.contractDetails?.optionType === 'PE');
      const longCE = expPositions.filter(p => p.side === 'BUY' && p.contractDetails?.optionType === 'CE');
      const longPE = expPositions.filter(p => p.side === 'BUY' && p.contractDetails?.optionType === 'PE');

      // Calculate standalone margin for each position first
      const standaloneMap: Record<string, number> = {};
      for (const pos of expPositions) {
        standaloneMap[pos.id] = calculateStandaloneMargin({
          symbol: pos.symbol,
          segment: pos.segment,
          side: pos.side,
          product: pos.product,
          quantity: pos.quantity,
          price: pos.averagePrice,
          contractDetails: pos.contractDetails,
        });
      }

      // Long options always pay 100% premium
      for (const pos of [...longCE, ...longPE]) {
        positionMargins[pos.id] = standaloneMap[pos.id];
      }

      const totalShortCEMargin = shortCE.reduce((sum, p) => sum + standaloneMap[p.id], 0);
      const totalShortPEMargin = shortPE.reduce((sum, p) => sum + standaloneMap[p.id], 0);

      // Check for Straddle / Strangle (Short CE + Short PE on same underlying & expiry)
      const isStraddleOrStrangle = shortCE.length > 0 && shortPE.length > 0;

      if (isStraddleOrStrangle) {
        // Exchange standard rule:
        // Leg with higher total margin pays 100%
        // Leg with lower total margin pays 25% (Exposure only, saving 75%)
        const ceIsPrimary = totalShortCEMargin >= totalShortPEMargin;

        // Primary legs get 100%
        const primaryGroup = ceIsPrimary ? shortCE : shortPE;
        const hedgedGroup = ceIsPrimary ? shortPE : shortCE;

        for (const pos of primaryGroup) {
          positionMargins[pos.id] = standaloneMap[pos.id];
        }

        // Discounted hedge legs get 25% of standalone margin
        for (const pos of hedgedGroup) {
          const discounted = Math.round(standaloneMap[pos.id] * 0.25 * 100) / 100;
          positionMargins[pos.id] = discounted;
          hedgedLegIds.add(pos.id);
          hedgeNotes[pos.id] = 'Straddle/Strangle (-75%)';
        }
      } else {
        // Naked short options: check if hedged by Long Options (Spread)
        for (const pos of shortCE) {
          if (longCE.length > 0) {
            // Spread hedge benefit: Long CE protects Short CE
            const discounted = Math.round(standaloneMap[pos.id] * 0.4 * 100) / 100; // 60% discount
            positionMargins[pos.id] = discounted;
            hedgedLegIds.add(pos.id);
            hedgeNotes[pos.id] = 'Spread Hedge (-60%)';
          } else {
            positionMargins[pos.id] = standaloneMap[pos.id];
          }
        }

        for (const pos of shortPE) {
          if (longPE.length > 0) {
            // Spread hedge benefit: Long PE protects Short PE
            const discounted = Math.round(standaloneMap[pos.id] * 0.4 * 100) / 100; // 60% discount
            positionMargins[pos.id] = discounted;
            hedgedLegIds.add(pos.id);
            hedgeNotes[pos.id] = 'Spread Hedge (-60%)';
          } else {
            positionMargins[pos.id] = standaloneMap[pos.id];
          }
        }
      }
    }
  }

  // Calculate total portfolio margin
  let totalMargin = 0;
  for (const m of Object.values(positionMargins)) {
    totalMargin += m;
  }
  totalMargin = Math.round(totalMargin * 100) / 100;

  return {
    totalMargin,
    positionMargins,
    hedgedLegIds,
    hedgeNotes,
  };
}

/**
 * Checks if two option contracts refer to the same instrument (matching symbol, strike, type, and expiry)
 */
export function isSameContract(
  a: { symbol: string; segment: string; product: string; contractDetails?: { strikePrice?: number; optionType?: 'CE' | 'PE'; expiryDate?: string } },
  b: { symbol: string; segment: string; product: string; contractDetails?: { strikePrice?: number; optionType?: 'CE' | 'PE'; expiryDate?: string } }
): boolean {
  if (a.symbol !== b.symbol || a.segment !== b.segment || a.product !== b.product) return false;
  if (a.segment === 'OPTION') {
    const strikeA = Math.round(a.contractDetails?.strikePrice || 0);
    const strikeB = Math.round(b.contractDetails?.strikePrice || 0);
    if (strikeA !== strikeB) return false;
    if (a.contractDetails?.optionType !== b.contractDetails?.optionType) return false;
    const expA = normalizeExpiryKey(a.contractDetails?.expiryDate);
    const expB = normalizeExpiryKey(b.contractDetails?.expiryDate);
    if (expA !== expB) return false;
  }
  return true;
}

export interface OrderMarginCheckResult {
  requiredMargin: number;
  isExit: boolean;
  isHedged: boolean;
  hedgeBenefitText?: string;
  releasedMarginEstimate?: number;
}

/**
 * Evaluates the required margin for a proposed order considering the user's existing portfolio:
 * - If order exits/reduces an open position: requiredMargin is 0 (releases margin!)
 * - If order forms a Straddle or Strangle: requiredMargin receives ~75% hedge discount
 */
export function calculateOrderMarginRequirement(
  existingPositions: Position[],
  orderParams: TradeOrderParams
): OrderMarginCheckResult {
  const openPositions = existingPositions.filter(p => p.status !== 'CLOSED' && p.quantity > 0);

  // 1. Check if this is an exit / square-off order for an existing opposite-side position
  const existingIdx = openPositions.findIndex(p => isSameContract(p, orderParams));

  if (existingIdx >= 0) {
    const existing = openPositions[existingIdx];
    if (existing.side !== orderParams.side) {
      // Opposite side: this order is exiting or reducing the position!
      const currentRes = calculatePortfolioMargin(openPositions);
      
      // Simulate positions after exit
      let simulated: Position[] = [];
      if (orderParams.quantity >= existing.quantity) {
        // Full exit (or flip)
        simulated = openPositions.filter((_, idx) => idx !== existingIdx);
        if (orderParams.quantity > existing.quantity) {
          const excessQty = orderParams.quantity - existing.quantity;
          simulated.push({
            ...existing,
            id: 'SIM_FLIP',
            side: orderParams.side,
            quantity: excessQty,
            averagePrice: orderParams.price,
            currentPrice: orderParams.price,
            marginUsed: 0,
          });
        }
      } else {
        // Partial exit
        simulated = openPositions.map((p, idx) => {
          if (idx !== existingIdx) return p;
          return {
            ...p,
            quantity: p.quantity - orderParams.quantity,
          };
        });
      }

      const nextRes = calculatePortfolioMargin(simulated);
      const marginDelta = nextRes.totalMargin - currentRes.totalMargin;

      if (marginDelta <= 0) {
        return {
          requiredMargin: 0,
          isExit: true,
          isHedged: false,
          releasedMarginEstimate: Math.abs(marginDelta),
        };
      } else {
        // Flipped to opposite side with excess quantity that requires margin
        return {
          requiredMargin: Math.round(marginDelta * 100) / 100,
          isExit: false,
          isHedged: false,
        };
      }
    }
  }

  // 2. Normal order: simulate adding the new order to the portfolio
  const standalone = calculateStandaloneMargin({
    symbol: orderParams.symbol,
    segment: orderParams.segment,
    side: orderParams.side,
    product: orderParams.product,
    quantity: orderParams.quantity,
    price: orderParams.price,
    contractDetails: orderParams.contractDetails,
  });

  const currentRes = calculatePortfolioMargin(openPositions);

  const simulatedOrderPos: Position = {
    id: 'SIM_ORDER',
    symbol: orderParams.symbol,
    name: orderParams.name,
    segment: orderParams.segment,
    side: orderParams.side,
    product: orderParams.product,
    quantity: orderParams.quantity,
    averagePrice: orderParams.price,
    currentPrice: orderParams.price,
    unrealizedPnL: 0,
    unrealizedPnLPerc: 0,
    realizedPnL: 0,
    marginUsed: standalone,
    openedAt: Date.now(),
    status: 'OPEN',
    contractDetails: orderParams.contractDetails,
  };

  // If adding to existing same-side position
  let simulated: Position[];
  if (existingIdx >= 0) {
    simulated = openPositions.map((p, idx) => {
      if (idx !== existingIdx) return p;
      return {
        ...p,
        quantity: p.quantity + orderParams.quantity,
      };
    });
  } else {
    simulated = [...openPositions, simulatedOrderPos];
  }

  const nextRes = calculatePortfolioMargin(simulated);
  const marginDelta = Math.max(0, nextRes.totalMargin - currentRes.totalMargin);
  const requiredMargin = Math.round(marginDelta * 100) / 100;

  // Check if hedge benefit was granted
  const isHedged = orderParams.side === 'SELL' && orderParams.segment === 'OPTION' && requiredMargin < standalone * 0.9;
  let hedgeBenefitText: string | undefined;

  if (isHedged) {
    const discountPerc = Math.round((1 - requiredMargin / standalone) * 100);
    hedgeBenefitText = `Straddle/Strangle Hedge Benefit Applied (-${discountPerc}% Margin)`;
  }

  return {
    requiredMargin,
    isExit: false,
    isHedged,
    hedgeBenefitText,
  };
}
