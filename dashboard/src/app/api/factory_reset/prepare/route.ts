import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { factoryReset } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

// In-memory token store (would be in NVS/RTC RAM on real firmware)
const tokens = new Map<string, number>(); // token -> expiresAt

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  // Generate token
  const token = Array.from({ length: 32 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
  const expiresAt = Date.now() + 60_000; // 60s
  tokens.set(token, expiresAt);
  return ok({ token, expiresAt }, 'Reset token generated (valid 60s)');
}

// Export token store for confirm route
export { tokens as resetTokens };
