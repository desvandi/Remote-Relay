import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { testPIRTrigger, getStore } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: { id: number };
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (!body.id || body.id < 1 || body.id > 4) {
    return fail('Invalid PIR id (1-4)');
  }
  const triggered = testPIRTrigger(body.id);
  if (!triggered) return fail('PIR in warm-up or unavailable');
  return ok({ triggered: true }, 'PIR triggered');
}
