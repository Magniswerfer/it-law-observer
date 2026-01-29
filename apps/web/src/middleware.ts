import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/constants';
import { getJwtEmail, isJwtValidNow } from '@/lib/auth/jwt';
import { supabaseRefresh } from '@/lib/auth/supabase';

function parseAdminEmails() {
  const raw = (process.env.ADMIN_EMAILS || '').trim();
  if (!raw) return null;
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return set.size ? set : null;
}

function isAllowedAdmin(accessToken: string) {
  const allow = parseAdminEmails();
  if (!allow) return true;
  const email = (getJwtEmail(accessToken) || '').toLowerCase();
  return email ? allow.has(email) : false;
}

function isAdminGuardPath(pathname: string) {
  if (pathname === '/admin/login') return false;
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (!isAdminGuardPath(pathname)) return NextResponse.next();

  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value || null;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value || null;

  if (accessToken && isJwtValidNow(accessToken) && isAllowedAdmin(accessToken)) {
    return NextResponse.next();
  }

  if (refreshToken) {
    try {
      const refreshed = await supabaseRefresh(refreshToken);
      if (refreshed?.access_token && isJwtValidNow(refreshed.access_token) && isAllowedAdmin(refreshed.access_token)) {
        const res = NextResponse.next();
        res.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.access_token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: Math.max(60, refreshed.expires_in),
        });
        res.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refresh_token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          // Supabase refresh tokens are long-lived; keep a conservative max age.
          maxAge: 60 * 60 * 24 * 30,
        });
        return res;
      }
    } catch {
      // Ignore refresh errors and fall through to login redirect.
    }
  }

  if (pathname.startsWith('/api/admin/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/admin/login';
  loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
