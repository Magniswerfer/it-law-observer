import { NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/constants';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/';

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

