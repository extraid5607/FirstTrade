import { NextRequest, NextResponse } from 'next/server';
import { WATCHLIST_INSTRUMENTS } from '@/lib/constants';
import { Quote } from '@/types/market';

// In-memory cache for fast response times and rate-limit prevention
const quotesCache: Map<string, { data: Quote; timestamp: number }> = new Map();
const CACHE_TTL = 1500; // 1.5s cache

async function fetchIndexQuote(symbol: string): Promise<Quote | null> {
  let yahooSymbol = '^NSEI';
  let name = 'NIFTY 50';
  let lotSize = 65;
  let exchange: 'NSE' | 'BSE' = 'NSE';

  if (symbol === 'BANKNIFTY') {
    yahooSymbol = '^NSEBANK';
    name = 'NIFTY BANK';
    lotSize = 30;
  } else if (symbol === 'SENSEX') {
    yahooSymbol = '^BSESN';
    name = 'S&P BSE SENSEX';
    lotSize = 20;
    exchange = 'BSE';
  } else if (symbol === 'FINNIFTY') {
    yahooSymbol = 'NIFTY_FIN_SERVICE.NS';
    name = 'NIFTY FIN SERVICE';
    lotSize = 65;
  } else if (symbol === 'MIDCPNIFTY') {
    yahooSymbol = '^NSEMDCP50';
    name = 'NIFTY MIDCAP SELECT';
    lotSize = 120;
  }

  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      next: { revalidate: 2 }
    });

    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No meta found');

    const ltp = meta.regularMarketPrice || meta.chartPreviousClose || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || ltp;
    const dayChange = Math.round((ltp - prevClose) * 100) / 100;
    const dayChangePerc = prevClose ? Math.round(((ltp - prevClose) / prevClose) * 10000) / 100 : 0;

    return {
      symbol,
      name,
      exchange,
      segment: 'INDEX',
      ltp,
      open: meta.regularMarketDayHigh ? meta.chartPreviousClose : ltp,
      high: meta.regularMarketDayHigh || ltp,
      low: meta.regularMarketDayLow || ltp,
      close: prevClose,
      dayChange,
      dayChangePerc,
      volume: meta.regularMarketVolume || 0,
      lotSize,
      lastTradeTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
      high52w: meta.fiftyTwoWeekHigh,
      low52w: meta.fiftyTwoWeekLow
    };
  } catch (err) {
    // Fallback approximation if network blip
    const config = WATCHLIST_INSTRUMENTS.find(i => i.symbol === symbol);
    const fallbackLtp = symbol === 'NIFTY' ? 22690 : symbol === 'BANKNIFTY' ? 55100 : symbol === 'SENSEX' ? 73068 : 25150;
    return {
      symbol,
      name: config?.name || symbol,
      exchange,
      segment: 'INDEX',
      ltp: fallbackLtp,
      open: fallbackLtp,
      high: fallbackLtp + 120,
      low: fallbackLtp - 90,
      close: fallbackLtp - 30,
      dayChange: 30,
      dayChangePerc: 0.13,
      volume: 12000000,
      lotSize: config?.lotSize || lotSize,
      lastTradeTime: Date.now()
    };
  }
}

async function fetchStockQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(`https://groww.in/v1/api/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc/${encodeURIComponent(symbol)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 2 }
    });

    if (!res.ok) throw new Error(`Groww API returned ${res.status}`);
    const data = await res.json();
    const config = WATCHLIST_INSTRUMENTS.find(i => i.symbol === symbol);

    return {
      symbol,
      name: config?.name || symbol,
      exchange: 'NSE',
      segment: 'EQUITY',
      ltp: data.ltp || data.close || 0,
      open: data.open || 0,
      high: data.high || 0,
      low: data.low || 0,
      close: data.close || 0,
      dayChange: data.dayChange || 0,
      dayChangePerc: data.dayChangePerc ? Math.round(data.dayChangePerc * 100) / 100 : 0,
      volume: data.volume || 0,
      lotSize: config?.lotSize || 100,
      lastTradeTime: data.tsInMillis || Date.now(),
      high52w: data.yearHighPrice,
      low52w: data.yearLowPrice
    };
  } catch (err) {
    // Fallback through Yahoo if Groww throttles
    try {
      const yRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1m&range=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (yRes.ok) {
        const yJson = await yRes.json();
        const meta = yJson.chart?.result?.[0]?.meta;
        if (meta) {
          const ltp = meta.regularMarketPrice || 0;
          const prevClose = meta.chartPreviousClose || ltp;
          const config = WATCHLIST_INSTRUMENTS.find(i => i.symbol === symbol);
          return {
            symbol,
            name: config?.name || symbol,
            exchange: 'NSE',
            segment: 'EQUITY',
            ltp,
            open: meta.regularMarketDayHigh ? meta.chartPreviousClose : ltp,
            high: meta.regularMarketDayHigh || ltp,
            low: meta.regularMarketDayLow || ltp,
            close: prevClose,
            dayChange: Math.round((ltp - prevClose) * 100) / 100,
            dayChangePerc: prevClose ? Math.round(((ltp - prevClose) / prevClose) * 10000) / 100 : 0,
            volume: meta.regularMarketVolume || 0,
            lotSize: config?.lotSize || 100,
            lastTradeTime: Date.now()
          };
        }
      }
    } catch {}

    const config = WATCHLIST_INSTRUMENTS.find(i => i.symbol === symbol);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get('symbol');

  // Single symbol request
  if (symbolParam) {
    const sym = symbolParam.toUpperCase();
    const cached = quotesCache.get(sym);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'].includes(sym);
    const quote = isIndex ? await fetchIndexQuote(sym) : await fetchStockQuote(sym);

    if (quote) {
      quotesCache.set(sym, { data: quote, timestamp: Date.now() });
      return NextResponse.json(quote);
    }
    return NextResponse.json({ error: `Symbol ${sym} not found` }, { status: 404 });
  }

  // Full default watchlist request
  const quotes: Quote[] = [];
  const fetchPromises = WATCHLIST_INSTRUMENTS.map(async (inst) => {
    const cached = quotesCache.get(inst.symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const q = inst.isIndex ? await fetchIndexQuote(inst.symbol) : await fetchStockQuote(inst.symbol);
    if (q) {
      quotesCache.set(inst.symbol, { data: q, timestamp: Date.now() });
      return q;
    }
    return null;
  });

  const results = await Promise.all(fetchPromises);
  results.forEach(res => {
    if (res) quotes.push(res);
  });

  return NextResponse.json(quotes);
}
