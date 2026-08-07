import { NextRequest } from 'next/server';
import { getStore, verifyCredentials } from '@/lib/mockStore';
import { createSession } from '@/lib/auth';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

// Simple in-memory rate limiter
const rateMap = new Map<string, { count: number; firstAt: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const BLOCK_MS = 60_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const entry = rateMap.get(ip);
  const now = Date.now();
  if (entry && entry.blockedUntil > now) {
    return fail('Too many attempts. Try again later.', 429);
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';

  if (!username || !password) {
    return fail('Username and password required');
  }

  // Ensure mock store is initialized before credential check
  await getStore();

  const valid = verifyCredentials(username, password);
  if (!valid) {
    let e = rateMap.get(ip);
    if (!e) {
      e = { count: 0, firstAt: now, blockedUntil: 0 };
      rateMap.set(ip, e);
    }
    e.count++;
    if (e.count >= MAX_ATTEMPTS) {
      e.blockedUntil = now + BLOCK_MS;
      e.count = 0;
    }
    return unauthorized('Invalid username or password');
  }

  // Reset rate limiter on success
  rateMap.delete(ip);

  const session = await createSession(username);
  await getStore(); // ensure initialized
  return ok(session, 'Login successful');
}
