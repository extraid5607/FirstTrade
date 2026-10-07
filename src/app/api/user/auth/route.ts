import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// GET: Load user profiles or verify unique username
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkUsername = searchParams.get('check');

    const usersMap: Record<string, string> = (await redis.get('ft_users_registry')) || {};

    if (checkUsername) {
      const lower = checkUsername.trim().toLowerCase();
      const isTaken = Object.keys(usersMap).some(u => u.toLowerCase() === lower);
      return NextResponse.json({ available: !isTaken });
    }

    // Return list of usernames (without passwords for security)
    const usernames = Object.keys(usersMap);
    return NextResponse.json({ users: usernames });
  } catch (error) {
    console.error('API /api/user/auth GET error', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST: Register or Login user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, username, password } = body;

    const trimmed = (username || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const usersMap: Record<string, string> = (await redis.get('ft_users_registry')) || {};

    if (action === 'REGISTER') {
      if (trimmed.length < 3) {
        return NextResponse.json({ error: 'User ID must be at least 3 characters' }, { status: 400 });
      }
      if (!password || password.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
      }

      const isTaken = Object.keys(usersMap).some(u => u.toLowerCase() === trimmed.toLowerCase());
      if (isTaken) {
        return NextResponse.json({ error: `User ID '${trimmed}' is already taken!` }, { status: 409 });
      }

      usersMap[trimmed] = password;
      await redis.set('ft_users_registry', usersMap);

      return NextResponse.json({ success: true, username: trimmed });
    }

    if (action === 'LOGIN') {
      const matchedKey = Object.keys(usersMap).find(u => u.toLowerCase() === trimmed.toLowerCase());
      if (!matchedKey) {
        return NextResponse.json({ error: `User ID '${trimmed}' not found. Please register first.` }, { status: 404 });
      }

      if (usersMap[matchedKey] !== password) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
      }

      return NextResponse.json({ success: true, username: matchedKey });
    }

    if (action === 'DELETE') {
      const matchedKey = Object.keys(usersMap).find(u => u.toLowerCase() === trimmed.toLowerCase());
      if (matchedKey) {
        delete usersMap[matchedKey];
        await redis.set('ft_users_registry', usersMap);
        await redis.del(`ft_user:${matchedKey}:data`);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API /api/user/auth POST error', error);
    return NextResponse.json({ error: 'Database operation failed' }, { status: 500 });
  }
}
