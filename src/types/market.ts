export interface Quote {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  segment: 'EQUITY' | 'INDEX' | 'FNO';
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  dayChange: number;
  dayChangePerc: number;
  volume: number;
  lotSize?: number;
  lastTradeTime?: number;
  high52w?: number;
  low52w?: number;
}

export interface OptionContract {
  strikePrice: number;
  growwContractId?: string;
  token?: string;
  marketLot: number;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  dayChange: number;
  dayChangePerc: number;
  volume: number;
  openInterest: number;
  prevOpenInterest: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionStrikeRow {
  strikePrice: number;
  callOption?: OptionContract;
  putOption?: OptionContract;
}

export interface OptionChainData {
  underlying: string;
  underlyingValue: number;
  expiryDates: string[];
  selectedExpiry: string;
  lotSize: number;
  strikes: OptionStrikeRow[];
  atmStrike: number;
  pcr: number;
  totalCallOI: number;
  totalPutOI: number;
  maxPain?: number;
}

export interface Candle {
  time: number; // unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
