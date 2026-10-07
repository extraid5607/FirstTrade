import { NextRequest, NextResponse } from 'next/server';
import { Candle } from '@/types/market';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'NIFTY').toUpperCase();
  const interval = searchParams.get('interval') || '5m';

  const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'].includes(symbol);

  try {
    let yahooSymbol = symbol + '.NS';
    if (symbol === 'NIFTY') yahooSymbol = '^NSEI';
    else if (symbol === 'BANKNIFTY') yahooSymbol = '^NSEBANK';
    else if (symbol === 'SENSEX') yahooSymbol = '^BSESN';
    else if (symbol === 'FINNIFTY') yahooSymbol = 'NIFTY_FIN_SERVICE.NS';
    else if (symbol === 'MIDCPNIFTY') yahooSymbol = '^NSEMDCP50';

    let range = '1d';
    let yInterval = interval;
    if (interval === '1d') range = '1mo';
    else if (interval === '15m' || interval === '1h') range = '5d';

    // 1. If stock and intraday, try Groww chart endpoint first for hyper-accurate Indian ticks
    if (!isIndex) {
      try {
        const intervalMins = interval === '1m' ? 1 : interval === '15m' ? 15 : interval === '1h' ? 60 : 5;
        const endTime = Date.now();
        const startTime = endTime - 86400000 * 2; // Last 2 days
        const gUrl = `https://groww.in/v1/api/charting_service/v2/chart/delayed/exchange/NSE/segment/CASH/${encodeURIComponent(symbol)}?endTimeInMillis=${endTime}&intervalInMinutes=${intervalMins}&startTimeInMillis=${startTime}`;
        const gRes = await fetch(gUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          cache: 'no-store'
        });

        if (gRes.ok) {
          const gData = await gRes.json();
          if (Array.isArray(gData.candles) && gData.candles.length > 0) {
            const candles: Candle[] = gData.candles.map((c: any) => ({
              time: Math.floor(c[0] / 1000) > 10000000000 ? Math.floor(c[0] / 1000) : c[0],
              open: Number(c[1]),
              high: Number(c[2]),
              low: Number(c[3]),
              close: Number(c[4]),
              volume: Number(c[5] || 0)
            })).sort((a: Candle, b: Candle) => a.time - b.time);

            return NextResponse.json({ symbol, interval, candles }, {
              headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
            });
          }
        }
      } catch {}
    }

    // 2. Fetch from Yahoo Finance as ultra-reliable feed
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${encodeURIComponent(yInterval)}&range=${encodeURIComponent(range)}&_t=${Date.now()}`;
    const yRes = await fetch(yUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      cache: 'no-store'
    });

    if (!yRes.ok) throw new Error(`Yahoo returned ${yRes.status}`);
    const yData = await yRes.json();
    const result = yData.chart?.result?.[0];

    if (!result || !result.timestamp) {
      throw new Error('No chart data found');
    }

    const timestamps: number[] = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    const opens = quote?.open || [];
    const highs = quote?.high || [];
    const lows = quote?.low || [];
    const closes = quote?.close || [];
    const volumes = quote?.volume || [];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] !== null && closes[i] !== null && highs[i] !== null && lows[i] !== null) {
        candles.push({
          time: timestamps[i],
          open: Math.round(opens[i] * 100) / 100,
          high: Math.round(highs[i] * 100) / 100,
          low: Math.round(lows[i] * 100) / 100,
          close: Math.round(closes[i] * 100) / 100,
          volume: Math.round(volumes[i] || 0)
        });
      }
    }

    candles.sort((a, b) => a.time - b.time);
    return NextResponse.json({ symbol, interval, candles }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
    });
  } catch (err: any) {
    // Generate synthetic realistic candles if API rate limited
    const basePrice = symbol === 'NIFTY' ? 22700 : symbol === 'BANKNIFTY' ? 55150 : 1215;
    const nowSec = Math.floor(Date.now() / 1000);
    const intervalSec = interval === '1m' ? 60 : interval === '15m' ? 900 : 300;
    const count = 75;
    const syntheticCandles: Candle[] = [];
    let cur = basePrice - 40;

    for (let i = count; i >= 0; i--) {
      const time = nowSec - i * intervalSec;
      const change = (Math.random() - 0.48) * (basePrice * 0.002);
      const open = cur;
      const close = cur + change;
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
      cur = close;
      syntheticCandles.push({
        time,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.floor(Math.random() * 50000 + 10000)
      });
    }

    return NextResponse.json({ symbol, interval, candles: syntheticCandles, isSimulated: true });
  }
}
