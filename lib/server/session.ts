import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { HttpError } from './http';
import type { ServerConfig } from './config';

export const SESSION_COOKIE = 'kotoba_session';
export const OAUTH_COOKIE = 'kotoba_oauth';
export type Session = { login: string; userId: number; exp: number };

export function signPayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function verifyPayload<T extends { exp: number }>(value: string | undefined, secret: string, now = Date.now()): T | null {
  if (!value || value.length > 4096) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const signature = createHmac('sha256', secret).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], 'base64url');
  if (signature.length !== supplied.length || !timingSafeEqual(signature, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return payload && Number.isFinite(payload.exp) && payload.exp > now ? payload as T : null;
  } catch { return null; }
}

export const randomToken = () => randomBytes(32).toString('base64url');

export function equalTokens(a: string, b: string): boolean {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function cookieOptions(config: ServerConfig, maxAge: number) {
  return { httpOnly: true, secure: config.appUrl.startsWith('https:'), sameSite: 'lax' as const, path: '/', maxAge };
}

export async function getSession(config: ServerConfig): Promise<Session | null> {
  const jar = await cookies();
  const session = verifyPayload<Session>(jar.get(SESSION_COOKIE)?.value, config.secret);
  return session && typeof session.login === 'string' && Number.isSafeInteger(session.userId) && session.login.toLowerCase() === config.allowedUser.toLowerCase() ? session : null;
}

export async function requireSession(config: ServerConfig): Promise<Session> {
  const session = await getSession(config);
  if (!session) throw new HttpError(401, 'Sign in to GitHub to synchronize your cards.');
  return session;
}
