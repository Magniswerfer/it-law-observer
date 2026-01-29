const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type SupabasePasswordGrantResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user?: unknown;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function supabaseAuthUrl(path: string) {
  const base = requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function supabaseAnonKey() {
  return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
}

export async function supabasePasswordLogin(email: string, password: string) {
  const res = await fetch(supabaseAuthUrl('/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  function getErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;
    if (typeof obj.error_description === 'string') return obj.error_description;
    if (typeof obj.msg === 'string') return obj.msg;
    if (typeof obj.error === 'string') return obj.error;
    return null;
  }

  if (!res.ok) {
    const msg = getErrorMessage(data) || `Login failed (${res.status})`;
    throw new Error(msg);
  }

  return data as SupabasePasswordGrantResponse;
}

export async function supabaseRefresh(refreshToken: string) {
  const res = await fetch(supabaseAuthUrl('/auth/v1/token?grant_type=refresh_token'), {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as SupabasePasswordGrantResponse | null;
  if (!res.ok || !data?.access_token || !data?.refresh_token) return null;
  return data;
}
