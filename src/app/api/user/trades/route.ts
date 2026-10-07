import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { INITIAL_DEMO_CAPITAL } from '@/lib/constants';

// Standardized safe user data key
function getUserDataKey(id: string): string {
  const clean = id.trim().toLowerCase();
  return `ft_user:${clean}:data`;
}

// GET: Load user trade data (balance, positions, orders) from Upstash Redis
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('username') || searchParams.get('email');

    if (!userId) {
      return NextResponse.json({ error: 'User identifier is required' }, { status: 400 });
    }

    const key = getUserDataKey(userId);
    let data: any = await redis.get(key);

    // Fallback: check raw key if legacy
    if (!data) {
      data = await redis.get(`ft_user:${userId}:data`);
    }

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
    const { userId, username, email, balance, positions, orders } = body;
    const targetId = userId || email || username;

    if (!targetId) {
      return NextResponse.json({ error: 'User identifier is required' }, { status: 400 });
    }

    const key = getUserDataKey(targetId);
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
