import { NextRequest, NextResponse } from 'next/server';
import { WATCHLIST_INSTRUMENTS } from '@/lib/constants';
import { calculateGreeks } from '@/lib/greeks';
import { OptionChainData, OptionStrikeRow } from '@/types/market';

const chainCache: Map<string, { data: OptionChainData; timestamp: number }> = new Map();
const CACHE_TTL = 2000; // 2 seconds

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'NIFTY').toUpperCase();
  const expiry = searchParams.get('expiry') || '';

  const cacheKey = `${symbol}_${expiry}`;
  const cached = chainCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  // Map symbol to Groww identifier
  const config = WATCHLIST_INSTRUMENTS.find(i => i.symbol === symbol);
  let growwId = config?.growwSearchId;
  if (!growwId) {
    if (symbol === 'SENSEX') growwId = 'sp-bse-sensex';
    else growwId = symbol.toLowerCase();
  }

  // 1. Fetch Option Chain data
  // Note: Groww's REST API endpoint /v1/option_chain/{id} only returns current week's contracts.
  // When next week or a specific expiry is requested, fetch from Groww's options page endpoint which provides all expiries.
  let rawList: any[] = [];
  let expiryDates: string[] = [];
  let selectedExpiry = expiry;
  let lotSize = config?.lotSize || (symbol === 'SENSEX' ? 20 : 65);

  try {
    let fetched = false;

    // A. If an expiry was explicitly selected, try the page endpoint first
    if (expiry) {
      try {
        const pageUrl = `https://groww.in/options/${encodeURIComponent(growwId)}?expiry=${encodeURIComponent(expiry)}`;
        const pRes = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          next: { revalidate: 2 }
        });

        if (pRes.ok) {
          const html = await pRes.text();
          const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
          if (match) {
            const nextData = JSON.parse(match[1]);
            const oc = nextData.props?.pageProps?.data?.optionChain;
            if (oc && Array.isArray(oc.optionContracts) && oc.optionContracts.length > 0) {
              expiryDates = oc.aggregatedDetails?.expiryDates || [];
              selectedExpiry = oc.aggregatedDetails?.currentExpiry || expiry;
              lotSize = oc.aggregatedDetails?.lotSize || lotSize;

              rawList = oc.optionContracts.map((c: any) => ({
                strikePrice: c.strikePrice, // in paisa
                callOption: c.ce ? {
                  ltp: c.ce.liveData?.ltp ?? c.ce.liveData?.close ?? 0,
                  open: c.ce.liveData?.open || 0,
                  high: c.ce.liveData?.high || 0,
                  low: c.ce.liveData?.low || 0,
                  close: c.ce.liveData?.close || 0,
                  dayChange: c.ce.liveData?.dayChange || 0,
                  dayChangePerc: c.ce.liveData?.dayChangePerc || 0,
                  volume: c.ce.liveData?.volume || 0,
                  openInterest: c.ce.liveData?.oi || 0,
                  prevOpenInterest: c.ce.liveData?.prevOI || 0,
                  growwContractId: c.ce.growwContractId,
                  token: c.ce.token,
                  marketLot: c.ce.marketLot || lotSize,
                  greeks: c.ce.greeks
                } : undefined,
                putOption: c.pe ? {
                  ltp: c.pe.liveData?.ltp ?? c.pe.liveData?.close ?? 0,
                  open: c.pe.liveData?.open || 0,
                  high: c.pe.liveData?.high || 0,
                  low: c.pe.liveData?.low || 0,
                  close: c.pe.liveData?.close || 0,
                  dayChange: c.pe.liveData?.dayChange || 0,
                  dayChangePerc: c.pe.liveData?.dayChangePerc || 0,
                  volume: c.pe.liveData?.volume || 0,
                  openInterest: c.pe.liveData?.oi || 0,
                  prevOpenInterest: c.pe.liveData?.prevOI || 0,
                  growwContractId: c.pe.growwContractId,
                  token: c.pe.token,
                  marketLot: c.pe.marketLot || lotSize,
                  greeks: c.pe.greeks
                } : undefined,
              }));
              fetched = true;
            }
          }
        }
      } catch (e: any) {
        console.warn('Groww page endpoint error for next week expiry:', e.message);
      }
    }

    // B. If not fetched (or current week), use the fast REST API endpoint
    if (!fetched) {
      const apiUrl = `https://groww.in/v1/api/option_chain_service/v1/option_chain/${encodeURIComponent(growwId)}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        next: { revalidate: 2 }
      });

      if (!res.ok) {
        throw new Error(`Groww option chain API returned ${res.status}`);
      }

      const json = await res.json();
      const rawChain = json.optionChain;

      if (!rawChain || !rawChain.optionChains) {
        throw new Error('Invalid option chain response');
      }

      expiryDates = rawChain.expiryDetailsDto?.expiryDates || [];
      selectedExpiry = expiry || rawChain.expiryDetailsDto?.currentExpiry || expiryDates[0] || '';
      lotSize = rawChain.expiryDetailsDto?.expiryLotSize || config?.lotSize || lotSize;
      rawList = rawChain.optionChains;
    }

    // 2. Determine accurate spot price
    let spotPrice = 0;
    const querySpot = Number(searchParams.get('spot') || 0);
    if (querySpot > 0) {
      spotPrice = querySpot;
    }

    // If not supplied in query, fetch live index spot price
    if (spotPrice === 0) {
      try {
        let yahooSymbol = '';
        if (symbol === 'NIFTY') yahooSymbol = '^NSEI';
        else if (symbol === 'BANKNIFTY') yahooSymbol = '^NSEBANK';
        else if (symbol === 'SENSEX') yahooSymbol = '^BSESN';
        else if (symbol === 'FINNIFTY') yahooSymbol = 'NIFTY_FIN_SERVICE.NS';
        else if (symbol === 'MIDCPNIFTY') yahooSymbol = '^NSEMDCP50';

        if (yahooSymbol) {
          const yRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            next: { revalidate: 2 }
          });
          if (yRes.ok) {
            const yJson = await yRes.json();
            const p = yJson.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (p && p > 0) spotPrice = p;
          }
        }
      } catch {}
    }

    // Calculate Days to Expiry (DTE)
    const now = new Date();
    const expDate = new Date(selectedExpiry);
    const diffTime = expDate.getTime() - now.getTime();
    const dte = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 0.2);

    let totalCallOI = 0;
    let totalPutOI = 0;

    // Transform strikes
    const strikeRows: OptionStrikeRow[] = [];

    // If spotPrice is still 0, find ATM strike using only liquid active strikes
    if (spotPrice === 0) {
      let minDiff = Infinity;
      for (const item of rawList) {
        const ceVol = item.callOption?.volume || 0;
        const peVol = item.putOption?.volume || 0;
        const ceOI = item.callOption?.openInterest || 0;
        const peOI = item.putOption?.openInterest || 0;
        if (ceVol === 0 && peVol === 0 && ceOI === 0 && peOI === 0) continue;

        const strike = (item.strikePrice || 0) / 100;
        const ceLtp = item.callOption?.ltp || 0;
        const peLtp = item.putOption?.ltp || 0;
        if (ceLtp > 0 && peLtp > 0) {
          const diff = Math.abs(ceLtp - peLtp);
          if (diff < minDiff) {
            minDiff = diff;
            spotPrice = strike;
          }
        }
      }
    }

    // Fallback if still 0
    if (spotPrice === 0 && rawList.length > 0) {
      let minDiff = Infinity;
      for (const item of rawList) {
        const strike = (item.strikePrice || 0) / 100;
        const ceLtp = item.callOption?.ltp || 0;
        const peLtp = item.putOption?.ltp || 0;
        if (ceLtp > 0 && peLtp > 0) {
          const diff = Math.abs(ceLtp - peLtp);
          if (diff < minDiff) {
            minDiff = diff;
            spotPrice = strike;
          }
        }
      }
      if (spotPrice === 0) {
        const mid = Math.floor(rawList.length / 2);
        spotPrice = (rawList[mid]?.strikePrice || 0) / 100;
      }
    }

    // Now format strikes & calculate Greeks
    for (const item of rawList) {
      const strike = (item.strikePrice || 0) / 100;
      if (strike <= 0) continue;

      let callOpt = undefined;
      if (item.callOption) {
        const ltp = item.callOption.ltp ?? item.callOption.close ?? 0;
        const greeks = calculateGreeks(spotPrice, strike, dte, ltp, 'CE');
        const oi = item.callOption.openInterest || 0;
        totalCallOI += oi;

        callOpt = {
          strikePrice: strike,
          growwContractId: item.callOption.growwContractId,
          token: item.callOption.token,
          marketLot: item.callOption.marketLot || lotSize,
          ltp,
          open: item.callOption.open || 0,
          high: item.callOption.high || 0,
          low: item.callOption.low || 0,
          close: item.callOption.close || 0,
          dayChange: item.callOption.dayChange || 0,
          dayChangePerc: item.callOption.dayChangePerc || 0,
          volume: item.callOption.volume || 0,
          openInterest: oi,
          prevOpenInterest: item.callOption.prevOpenInterest || oi,
          impliedVolatility: greeks.iv,
          delta: greeks.delta,
          gamma: greeks.gamma,
          theta: greeks.theta,
          vega: greeks.vega,
        };
      }

      let putOpt = undefined;
      if (item.putOption) {
        const ltp = item.putOption.ltp ?? item.putOption.close ?? 0;
        const greeks = calculateGreeks(spotPrice, strike, dte, ltp, 'PE');
        const oi = item.putOption.openInterest || 0;
        totalPutOI += oi;

        putOpt = {
          strikePrice: strike,
          growwContractId: item.putOption.growwContractId,
          token: item.putOption.token,
          marketLot: item.putOption.marketLot || lotSize,
          ltp,
          open: item.putOption.open || 0,
          high: item.putOption.high || 0,
          low: item.putOption.low || 0,
          close: item.putOption.close || 0,
          dayChange: item.putOption.dayChange || 0,
          dayChangePerc: item.putOption.dayChangePerc || 0,
          volume: item.putOption.volume || 0,
          openInterest: oi,
          prevOpenInterest: item.putOption.prevOpenInterest || oi,
          impliedVolatility: greeks.iv,
          delta: greeks.delta,
          gamma: greeks.gamma,
          theta: greeks.theta,
          vega: greeks.vega,
        };
      }

      strikeRows.push({
        strikePrice: strike,
        callOption: callOpt,
        putOption: putOpt,
      });
    }

    // Sort by strike ascending
    strikeRows.sort((a, b) => a.strikePrice - b.strikePrice);

    // Filter around ATM strike to 30 strikes above and below for fast UI rendering
    let atmIndex = 0;
    let closestDistance = Infinity;
    for (let i = 0; i < strikeRows.length; i++) {
      const dist = Math.abs(strikeRows[i].strikePrice - spotPrice);
      if (dist < closestDistance) {
        closestDistance = dist;
        atmIndex = i;
      }
    }

    const atmStrike = strikeRows[atmIndex]?.strikePrice || spotPrice;
    const startIndex = Math.max(0, atmIndex - 30);
    const endIndex = Math.min(strikeRows.length, atmIndex + 31);
    const visibleStrikes = strikeRows.slice(startIndex, endIndex);

    // Calculate Max Pain
    let maxPain = atmStrike;
    let minTotalLoss = Infinity;
    for (const testStrike of visibleStrikes) {
      let totalLoss = 0;
      for (const row of visibleStrikes) {
        if (row.callOption && testStrike.strikePrice > row.strikePrice) {
          totalLoss += (testStrike.strikePrice - row.strikePrice) * (row.callOption.openInterest || 0);
        }
        if (row.putOption && testStrike.strikePrice < row.strikePrice) {
          totalLoss += (row.strikePrice - testStrike.strikePrice) * (row.putOption.openInterest || 0);
        }
      }
      if (totalLoss < minTotalLoss && totalLoss > 0) {
        minTotalLoss = totalLoss;
        maxPain = testStrike.strikePrice;
      }
    }

    const pcr = totalCallOI > 0 ? Math.round((totalPutOI / totalCallOI) * 100) / 100 : 1.0;

    const result: OptionChainData = {
      underlying: symbol,
      underlyingValue: spotPrice,
      expiryDates,
      selectedExpiry,
      lotSize,
      strikes: visibleStrikes,
      atmStrike,
      pcr,
      totalCallOI,
      totalPutOI,
      maxPain,
    };

    chainCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error in Option Chain API:', err.message);
    return NextResponse.json({ error: err.message || 'Failed to fetch option chain' }, { status: 500 });
  }
}
