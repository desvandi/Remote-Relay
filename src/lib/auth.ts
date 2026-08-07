// =============================================================================
// Server-side auth helpers (mock API)
// =============================================================================

import { cookies } from 'next/headers';
import { verifyJwt, generateRandomToken } from '@/lib/jwt';
import { getStore, getJwtSecret } from '@/lib/mockStore';

export const JWT_COOKIE = 'timer12_jwt';
export const CSRF_COOKIE = 'timer12_csrf';
const SESSION_TTL_SECONDS = 3600; // 1 hour

export type AuthResult = {
  authenticated: boolean;
  username: string | null;
  expiresAt: number | null;
};

export async function getSession(): Promise<AuthResult> {
  const store = await getStore();
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE)?.value;
  if (!token) return { authenticated: false, username: null, expiresAt: null };
  const payload = verifyJwt(token, getJwtSecret());
  if (!payload) return { authenticated: false, username: null, expiresAt: null };
  return {
    authenticated: true,
    username: payload.sub ?? null,
    expiresAt: payload.exp,
  };
}

export async function requireAuth(): Promise<{ ok: true; username: string } | { ok: false; status: 401; message: string }> {
  const session = await getSession();
  if (!session.authenticated) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  return { ok: true, username: session.username! };
}

export async function createSession(username: string) {
  const store = await getStore();
  const token = signSession(username, SESSION_TTL_SECONDS);
  const csrfToken = generateRandomToken(32);
  const cookieStore = await cookies();
  cookieStore.set(JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  cookieStore.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false, // client needs to read and resend in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return { token, csrfToken, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000, username };
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(JWT_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export async function verifyCsrfToken(req: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!cookieToken) return false;
  const headerToken = req.headers.get('X-CSRF-Token');
  if (!headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    diff |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return diff === 0;
}

import { signJwt } from '@/lib/jwt';
function signSession(username: string, ttlSeconds: number) {
  return signJwt({ sub: username }, getJwtSecret(), ttlSeconds);
}
