import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from './constants';
import { getJwtEmail, isJwtValidNow } from './jwt';

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

export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token || !isJwtValidNow(token)) return false;
  const allow = parseAdminEmails();
  if (!allow) return true;
  const email = (getJwtEmail(token) || '').toLowerCase();
  return email ? allow.has(email) : false;
}
