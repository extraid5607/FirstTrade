import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  if (!q.trim()) {
    return NextResponse.json([]);
  }

  try {
    const res = await fetch(`https://groww.in/v1/api/search/v1/entity?app=false&entity_type=stocks&q=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    const items = (data.content || []).map((item: any) => ({
      symbol: item.nse_scrip_code || item.search_id?.toUpperCase() || item.title,
      name: item.title,
      exchange: item.bse_scrip_code && !item.nse_scrip_code ? 'BSE' : 'NSE',
      segment: item.entity_type === 'Index' ? 'INDEX' : 'EQUITY',
      searchId: item.search_id,
      growwContractId: item.groww_contract_id
    }));

    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json([]);
  }
}
