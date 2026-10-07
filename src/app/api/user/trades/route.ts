import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { INITIAL_DEMO_CAPITAL } from '@/lib/constants';

// GET: Load user trade data (balance, positions, orders) from Upstash Redis
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const key = `ft_user:${username}:data`;
    const data: any = await redis.get(key);

    if (!data) {
      return NextResponse.json({
        balance: INITIAL_DEMO_CAPITAL,
        positions: [],
        orders: [],
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API /api/user/trades GET error', error);
    return NextResponse.json({ error: 'Failed to load trade data' }, { status: 500 });
  }
}

// POST: Save user trade data to Upstash Redis
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, balance, positions, orders } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const key = `ft_user:${username}:data`;
    await redis.set(key, {
      balance,
      positions,
      orders,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /api/user/trades POST error', error);
    return NextResponse.json({ error: 'Failed to save trade data' }, { status: 500 });
  }
}
