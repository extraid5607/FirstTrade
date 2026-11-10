import { Position } from '@/types/trading';

/**
 * Returns UTC timestamp for 15:30:00 IST (10:00:00 UTC) on the expiry date.
 */
export function getExpiryTimestamp(expiryDate?: string): number | null {
  if (!expiryDate || expiryDate === 'CURRENT') return null;
  const clean = expiryDate.trim();

  // Try parsing YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    // 15:30 IST = 10:00 UTC
    return Date.UTC(year, month, day, 10, 0, 0);
  }

  // Try parsing DD-MMM-YYYY or DD-MM-YYYY
  const parts = clean.split(/[-/ ]/);
  if (parts.length === 3) {
    const MONTHS: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };
    let y = 0, m = -1, d = 0;
    if (parts[0].length === 4) {
      y = parseInt(parts[0], 10);
      m = MONTHS[parts[1].toUpperCase()] ?? (parseInt(parts[1], 10) - 1);
      d = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      d = parseInt(parts[0], 10);
      m = MONTHS[parts[1].toUpperCase()] ?? (parseInt(parts[1], 10) - 1);
      y = parseInt(parts[2], 10);
    }
    if (y > 0 && m >= 0 && d > 0) {
      return Date.UTC(y, m, d, 10, 0, 0);
    }
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  return null;
}

/**
 * Returns true if the contract has expired (now >= 15:30 IST on expiry date).
 */
export function isOptionExpired(expiryDate?: string, now: Date = new Date()): boolean {
  const ts = getExpiryTimestamp(expiryDate);
  if (!ts) return false;
  return now.getTime() >= ts;
}

/**
 * Returns true if the contract expired on a calendar day PRIOR to today (in IST).
 */
export function isExpiredOnPastDay(expiryDate?: string, now: Date = new Date()): boolean {
  const ts = getExpiryTimestamp(expiryDate);
  if (!ts) return false;

  const istOffset = 5.5 * 60 * 60 * 1000;
  const expIST = new Date(ts + istOffset);
  const nowIST = new Date(now.getTime() + istOffset);

  const expDay = new Date(Date.UTC(expIST.getUTCFullYear(), expIST.getUTCMonth(), expIST.getUTCDate()));
  const nowDay = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()));

  return expDay < nowDay;
}

/**
 * Returns true if the contract expires TODAY and time is past 15:30 IST.
 */
export function isExpiredToday(expiryDate?: string, now: Date = new Date()): boolean {
  const ts = getExpiryTimestamp(expiryDate);
  if (!ts) return false;

  const istOffset = 5.5 * 60 * 60 * 1000;
  const expIST = new Date(ts + istOffset);
  const nowIST = new Date(now.getTime() + istOffset);

  const isSameDay =
    expIST.getUTCFullYear() === nowIST.getUTCFullYear() &&
    expIST.getUTCMonth() === nowIST.getUTCMonth() &&
    expIST.getUTCDate() === nowIST.getUTCDate();

  return isSameDay && now.getTime() >= ts;
}

/**
 * Check if a timestamp occurred on the current calendar day
 */
export function isTodayDate(timestamp?: number): boolean {
  if (!timestamp) return true;
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * Inspects all positions and:
 * 1. Auto-deletes options and intraday positions that expired on a past day (refunds marginUsed).
 * 2. Auto-settles options that expired today after 15:30 IST (marks CLOSED, settles P&L, refunds margin).
 * 3. Removes CLOSED positions from previous days.
 */
export function cleanAndSettlePositions(
  positions: Position[],
  currentBalance: number,
  now: Date = new Date()
): {
  cleanPositions: Position[];
  newBalance: number;
  changed: boolean;
  refundedMargin: number;
} {
  let newBalance = currentBalance;
  let refundedMargin = 0;
  let changed = false;
  const cleanPositions: Position[] = [];

  for (const pos of positions) {
    const isOption = pos.segment === 'OPTION';
    const expiry = pos.contractDetails?.expiryDate;

    // 1. Closed positions from previous days -> auto-delete
    if (pos.status === 'CLOSED') {
      if (!isTodayDate(pos.closedAt || pos.openedAt)) {
        changed = true;
        continue; // drop from today's active positions
      }
      cleanPositions.push(pos);
      continue;
    }

    // 2. Open positions: check if expired on a past day
    const isPastExp = isOption && isExpiredOnPastDay(expiry, now);
    const isPastIntraday = pos.product === 'INTRADAY' && !isTodayDate(pos.openedAt);

    if (isPastExp || isPastIntraday) {
      // Auto-delete past expired position and refund its blocked margin
      changed = true;
      if (pos.marginUsed > 0) {
        refundedMargin += pos.marginUsed;
      }
      continue;
    }

    // 3. Open positions: check if expired TODAY after 15:30 IST
    const isExpToday = isOption && isExpiredToday(expiry, now);
    if (isExpToday) {
      changed = true;
      // Auto-settle option at expiry
      // Out of the money options expire at 0
      // In the money settle at intrinsic value:
      let settlementPrice = 0;
      const strike = pos.contractDetails?.strikePrice || 0;
      const spot = pos.currentPrice || 0;
      if (pos.contractDetails?.optionType === 'CE') {
        settlementPrice = Math.max(0, spot - strike);
      } else if (pos.contractDetails?.optionType === 'PE') {
        settlementPrice = Math.max(0, strike - spot);
      }

      // Calculate final realized P&L at settlement
      const realizedPnL =
        pos.side === 'BUY'
          ? (settlementPrice - pos.averagePrice) * pos.quantity
          : (pos.averagePrice - settlementPrice) * pos.quantity;

      // Refund margin + P&L
      const netCredit = pos.marginUsed + realizedPnL;
      newBalance += netCredit;

      // Keep as CLOSED for today
      cleanPositions.push({
        ...pos,
        status: 'CLOSED',
        closedAt: now.getTime(),
        exitPrice: settlementPrice,
        realizedPnL,
        unrealizedPnL: 0,
        unrealizedPnLPerc: 0,
        marginUsed: 0,
      });
      continue;
    }

    // Active position
    cleanPositions.push(pos);
  }

  newBalance += refundedMargin;

  return {
    cleanPositions,
    newBalance,
    changed,
    refundedMargin,
  };
}
