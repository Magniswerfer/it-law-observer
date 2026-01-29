export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json =
      typeof globalThis.atob === 'function'
        ? decodeURIComponent(
            Array.prototype.map
              .call(globalThis.atob(padded), (c: string) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
              .join(''),
          )
        : Buffer.from(padded, 'base64').toString('utf8');
    const data = JSON.parse(json);
    return typeof data === 'object' && data ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function getJwtExpSeconds(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === 'number' ? exp : null;
}

export function getJwtEmail(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const email = payload?.email;
  return typeof email === 'string' ? email : null;
}

export function isJwtValidNow(token: string, opts?: { skewSeconds?: number }): boolean {
  const exp = getJwtExpSeconds(token);
  if (!exp) return false;
  const skew = opts?.skewSeconds ?? 30;
  const now = Math.floor(Date.now() / 1000);
  return exp > now + skew;
}
