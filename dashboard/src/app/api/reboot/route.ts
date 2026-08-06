import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { reboot } from '@/lib/mockStore';
import { ok, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return unauthorized('Invalid CSRF token');
  reboot();
  return ok({ rebooting: true }, 'System rebooting');
}
