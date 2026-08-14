import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { generateRandomToken } from '@/lib/jwt';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

// In-memory token store (would be in NVS/RTC RAM on real firmware)
const tokens = new Map<string, number>(); // token -> expiresAt

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  // audit-fixes: replace Math.random() with CSPRNG-based generateRandomToken().
  //   Math.random() is NOT cryptographically secure — its output can be
  //   predicted from a small sample of outputs. A factory reset token generated
  //   with Math.random() could be brute-forced or predicted, allowing an
  //   authenticated attacker (e.g., via XSS) to factory-reset the device
  //   without knowing the actual token. generateRandomToken() uses
  //   crypto.randomBytes() (CSPRNG).
  const token = generateRandomToken(32);
  const expiresAt = Date.now() + 60_000; // 60s
  tokens.set(token, expiresAt);
  return ok({ token, expiresAt }, 'Reset token generated (valid 60s)');
}

// Export token store for confirm route
export { tokens as resetTokens };
