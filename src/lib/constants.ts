export interface InstrumentConfig {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  segment: 'INDEX' | 'EQUITY';
  lotSize: number;
  strikeStep: number;
  growwSearchId?: string;
  growwSymbol?: string;
  isIndex?: boolean;
}

export const WATCHLIST_INSTRUMENTS: InstrumentConfig[] = [
  {
    symbol: 'NIFTY',
    name: 'NIFTY 50',
    exchange: 'NSE',
    segment: 'INDEX',
    lotSize: 65,
    strikeStep: 50,
    growwSearchId: 'nifty',
    growwSymbol: 'NIFTY',
    isIndex: true,
  },
  {
    symbol: 'BANKNIFTY',
    name: 'NIFTY BANK',
    exchange: 'NSE',
    segment: 'INDEX',
    lotSize: 30,
    strikeStep: 100,
    growwSearchId: 'nifty-bank',
    growwSymbol: 'BANKNIFTY',
    isIndex: true,
  },
  {
    symbol: 'SENSEX',
    name: 'S&P BSE SENSEX',
    exchange: 'BSE',
    segment: 'INDEX',
    lotSize: 20,
    strikeStep: 100,
    growwSearchId: 'sp-bse-sensex',
    growwSymbol: 'SENSEX',
    isIndex: true,
  },
  {
    symbol: 'FINNIFTY',
    name: 'NIFTY FIN SERVICE',
    exchange: 'NSE',
    segment: 'INDEX',
    lotSize: 65,
    strikeStep: 50,
    growwSearchId: 'nifty-financial-services',
    growwSymbol: 'FINNIFTY',
    isIndex: true,
  },
  {
    symbol: 'MIDCPNIFTY',
    name: 'NIFTY MIDCAP SELECT',
    exchange: 'NSE',
    segment: 'INDEX',
    lotSize: 120,
    strikeStep: 25,
    growwSearchId: 'nifty-midcap-select',
    growwSymbol: 'MIDCPNIFTY',
    isIndex: true,
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 250,
    strikeStep: 20,
    growwSearchId: 'reliance-industries-ltd',
    growwSymbol: 'RELIANCE',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 550,
    strikeStep: 10,
    growwSearchId: 'hdfc-bank-ltd',
    growwSymbol: 'HDFCBANK',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 175,
    strikeStep: 50,
    growwSearchId: 'tata-consultancy-services-ltd',
    growwSymbol: 'TCS',
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 400,
    strikeStep: 20,
    growwSearchId: 'infosys-ltd',
    growwSymbol: 'INFY',
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 700,
    strikeStep: 10,
    growwSearchId: 'icici-bank-ltd',
    growwSymbol: 'ICICIBANK',
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 575,
    strikeStep: 10,
    growwSearchId: 'tata-motors-ltd',
    growwSymbol: 'TATAMOTORS',
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 750,
    strikeStep: 10,
    growwSearchId: 'state-bank-of-india',
    growwSymbol: 'SBIN',
  },
  {
    symbol: 'ITC',
    name: 'ITC Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 1600,
    strikeStep: 5,
    growwSearchId: 'itc-ltd',
    growwSymbol: 'ITC',
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 475,
    strikeStep: 20,
    growwSearchId: 'bharti-airtel-ltd',
    growwSymbol: 'BHARTIARTL',
  },
  {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd',
    exchange: 'NSE',
    segment: 'EQUITY',
    lotSize: 175,
    strikeStep: 50,
    growwSearchId: 'larsen-toubro-ltd',
    growwSymbol: 'LT',
  }
];

export const INITIAL_DEMO_CAPITAL = 1000000; // 10 Lakhs INR

const MONTH_NAMES_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Dynamically calculates the next upcoming weekday date in YYYY-MM-DD (IST).
 * If today is that weekday and time is past 15:30 IST, rolls to the following week.
 */
export function getNextUpcomingWeekday(targetDayOfWeek: number, now: Date = new Date()): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  const currentDay = istNow.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const currentHours = istNow.getHours();
  const currentMinutes = istNow.getMinutes();

  let diff = targetDayOfWeek - currentDay;
  if (diff < 0 || (diff === 0 && (currentHours > 15 || (currentHours === 15 && currentMinutes >= 30)))) {
    diff += 7;
  }

  const targetDate = new Date(istNow);
  targetDate.setDate(istNow.getDate() + diff);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns current nearest upcoming expiry date for known Indian index symbols
 */
export function getDefaultExpiry(symbol: string): string {
  const sym = (symbol || '').toUpperCase();
  if (sym === 'MIDCPNIFTY') return getNextUpcomingWeekday(1); // Monday
  if (sym === 'FINNIFTY') return getNextUpcomingWeekday(2);   // Tuesday
  if (sym === 'BANKNIFTY') return getNextUpcomingWeekday(3);  // Wednesday
  if (sym === 'NIFTY') return getNextUpcomingWeekday(4);      // Thursday
  if (sym === 'SENSEX') return getNextUpcomingWeekday(5);     // Friday
  return getNextUpcomingWeekday(4);                           // Default Thursday
}

/**
 * Formats an expiry date string (e.g. '2026-10-08') into a compact badge: '08 OCT'
 */
export function formatExpiryBadge(expiryDate?: string, symbol?: string): string {
  let dateStr = expiryDate?.trim();
  if (!dateStr || dateStr === 'CURRENT') {
    dateStr = getDefaultExpiry(symbol || '');
  }
  if (!dateStr) return '';

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const mIdx = parseInt(parts[1], 10) - 1;
    const mStr = MONTH_NAMES_SHORT[mIdx] || parts[1];
    return `${day} ${mStr}`;
  }

  return dateStr;
}

/**
 * Formats an expiry date string (e.g. '2026-10-08') into full human date: '08 Oct 2026'
 */
export function formatExpiryFull(expiryDate?: string, symbol?: string): string {
  let dateStr = expiryDate?.trim();
  if (!dateStr || dateStr === 'CURRENT') {
    dateStr = getDefaultExpiry(symbol || '');
  }
  if (!dateStr) return '';

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const mIdx = parseInt(parts[1], 10) - 1;
    const mStr = MONTH_NAMES_TITLE[mIdx] || parts[1];
    const year = parts[0];
    return `${day} ${mStr} ${year}`;
  }

  return dateStr;
}

