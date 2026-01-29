import { NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/constants';
import { supabasePasswordLogin } from '@/lib/auth/supabase';

function safeNextUrl(next: string | null) {
  if (!next) return '/admin';
  // Only allow internal paths.
  if (!next.startsWith('/')) return '/admin';
  if (next.startsWith('//')) return '/admin';
  return next;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const email = String(form?.get('email') || '').trim();
  const password = String(form?.get('password') || '');
  const next = safeNextUrl(String(form?.get('next') || '') || null);

  if (!email || !password) {
    return NextResponse.redirect(new URL(`/admin/login?error=missing&next=${encodeURIComponent(next)}`, req.url));
  }

  try {
    const session = await supabasePasswordLogin(email, password);

    const res = NextResponse.redirect(new URL(next, req.url));
    res.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Math.max(60, session.expires_in),
    });
    res.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Login failed';
    const url = new URL('/admin/login', req.url);
    url.searchParams.set('error', msg);
    url.searchParams.set('next', next);
    return NextResponse.redirect(url);
  }
}

