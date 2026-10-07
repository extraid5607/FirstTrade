import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// GET: Check if email exists
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkEmail = searchParams.get('email');

    const usersMap: Record<string, { password: string; name?: string }> = 
      (await redis.get('ft_users_registry_v2')) || {};

    if (checkEmail) {
      const lower = checkEmail.trim().toLowerCase();
      const isTaken = Object.keys(usersMap).some(e => e.toLowerCase() === lower);
      return NextResponse.json({ available: !isTaken });
    }

    return NextResponse.json({ count: Object.keys(usersMap).length });
  } catch (error) {
    console.error('API /api/user/auth GET error', error);
    return NextResponse.json({ error: 'Failed to query users' }, { status: 500 });
  }
}

// POST: Sign Up, Sign In, Delete Account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password } = body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid Gmail / Email address' }, { status: 400 });
    }

    const usersMap: Record<string, { password: string; name?: string }> = 
      (await redis.get('ft_users_registry_v2')) || {};

    // 1. SIGN UP (Create new account with Email & Password)
    if (action === 'SIGNUP' || action === 'REGISTER') {
      if (!password || password.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
      }

      if (usersMap[cleanEmail]) {
        return NextResponse.json({ error: 'An account with this email already exists! Please Sign In.' }, { status: 409 });
      }

      usersMap[cleanEmail] = { password };
      await redis.set('ft_users_registry_v2', usersMap);

      return NextResponse.json({ 
        success: true, 
        email: cleanEmail 
      });
    }

    // 2. SIGN IN (Login with Email & Password)
    if (action === 'SIGNIN' || action === 'LOGIN') {
      const user = usersMap[cleanEmail];
      if (!user) {
        return NextResponse.json({ error: 'No account found with this email. Please Sign Up first.' }, { status: 404 });
      }

      if (user.password !== password) {
        return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
      }

      return NextResponse.json({ 
        success: true, 
        email: cleanEmail 
      });
    }

    // 3. DELETE ACCOUNT
    if (action === 'DELETE') {
      if (usersMap[cleanEmail]) {
        delete usersMap[cleanEmail];
        await redis.set('ft_users_registry_v2', usersMap);
        await redis.del(`ft_user:${cleanEmail}:data`);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API /api/user/auth POST error', error);
    return NextResponse.json({ error: 'Database operation failed' }, { status: 500 });
  }
}
