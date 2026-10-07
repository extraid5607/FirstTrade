import { NextRequest, NextResponse } from 'next/server';
import { WATCHLIST_INSTRUMENTS } from '@/lib/constants';

interface PositionQuery {
  id?: string;
  symbol: string;
  segment: 'EQUITY' | 'OPTION' | 'FUTURE';
  strike?: number;
  optionType?: 'CE' | 'PE';
  expiry?: string;
  contractDetails?: {
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: string;
    lotSize?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const positions: PositionQuery[] = body.positions || [];

    if (!Array.isArray(positions) || positions.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    const priceMap: Record<string, number> = {};

    // Group options by underlying symbol and expiry date
    const optionGroups = new Map<string, { symbol: string; expiry?: string }>();
    positions.forEach(p => {
      if (p.segment === 'OPTION' && p.symbol) {
        const sym = p.symbol.toUpperCase();
        const exp = p.expiry || p.contractDetails?.expiryDate || '';
        const key = `${sym}|${exp}`;
        if (!optionGroups.has(key)) {
          optionGroups.set(key, { symbol: sym, expiry: exp });
        }
      }
    });

    // Fetch option chains for required symbol + expiry combinations
    const optionChains: Record<string, any[]> = {};
    for (const [key, { symbol: sym, expiry: exp }] of Array.from(optionGroups.entries())) {
      try {
        const config = WATCHLIST_INSTRUMENTS.find(i => i.symbol === sym);
        const growwId = config?.growwSearchId || (sym === 'SENSEX' ? 'sp-bse-sensex' : sym.toLowerCase());
        
        let loaded = false;

        // Try page endpoint for future expiries
        if (exp) {
          try {
            const pageUrl = `https://groww.in/options/${encodeURIComponent(growwId)}?expiry=${encodeURIComponent(exp)}`;
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
                  optionChains[key] = oc.optionContracts.map((c: any) => ({
                    strikePrice: c.strikePrice,
                    callOption: c.ce ? { ltp: c.ce.liveData?.ltp ?? c.ce.liveData?.close ?? 0 } : undefined,
                    putOption: c.pe ? { ltp: c.pe.liveData?.ltp ?? c.pe.liveData?.close ?? 0 } : undefined
                  }));
                  loaded = true;
                }
              }
            }
          } catch {}
        }

        if (!loaded) {
          const res = await fetch(`https://groww.in/v1/api/option_chain_service/v1/option_chain/${encodeURIComponent(growwId)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 2 }
          });
          if (res.ok) {
            const json = await res.json();
            optionChains[key] = json.optionChain?.optionChains || [];
          }
        }
      } catch (e) {
        console.error(`Failed to fetch chain for ${key}`, e);
      }
    }

    // Now resolve prices for each position
    for (const pos of positions) {
      const sym = pos.symbol.toUpperCase();
      const strike = pos.strike ?? pos.contractDetails?.strikePrice;
      const optionType = pos.optionType ?? pos.contractDetails?.optionType;
      const exp = pos.expiry || pos.contractDetails?.expiryDate || '';

      if (pos.segment === 'OPTION' && strike && optionType) {
        const key = `${sym}|${exp}`;
        // Fallback to symbol without expiry if not found
        const chain = optionChains[key] || optionChains[`${sym}|`] || [];
        const found = chain.find((c: any) => Math.round(c.strikePrice / 100) === Math.round(strike));

        const priceKey = `${sym}_${strike}_${optionType}`;
        if (found) {
          const ltp = optionType === 'CE' ? (found.callOption?.ltp ?? found.callOption?.close) : (found.putOption?.ltp ?? found.putOption?.close);
          if (ltp !== undefined && ltp !== null && ltp > 0) {
            priceMap[priceKey] = ltp;
            if (pos.id) {
              priceMap[pos.id] = ltp;
            }
          }
        }
      } else if (pos.segment === 'EQUITY' || pos.segment === 'FUTURE') {
        try {
          const res = await fetch(`https://groww.in/v1/api/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc/${encodeURIComponent(sym)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 2 }
          });
          if (res.ok) {
            const data = await res.json();
            const ltp = data.ltp || data.close || 0;
            if (pos.segment === 'EQUITY') {
              priceMap[sym] = ltp;
            } else {
              priceMap[`${sym}_FUT`] = Math.round(ltp * 1.002 * 10) / 10;
            }
          }
        } catch {}
      }
    }

    return NextResponse.json({ prices: priceMap });
  } catch (err: any) {
    console.error('Error in positions-quotes API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
