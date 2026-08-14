import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { reboot } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  // audit-fixes: was returning 401 (unauthorized) for CSRF failure, but
  //   CSRF failure means the user IS authenticated but the request is
  //   cross-site forged. Correct status is 403 (forbidden). The previous
  //   401 caused some clients to retry with fresh credentials unnecessarily.
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);
  reboot();
  return ok({ rebooting: true }, 'System rebooting');
}
