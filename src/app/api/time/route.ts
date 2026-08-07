import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { setRtcTime } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: { datetime?: string };
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (!body.datetime) return fail('Missing datetime');
  const dt = new Date(body.datetime);
  if (isNaN(dt.getTime())) return fail('Invalid datetime (use ISO 8601)');
  setRtcTime(body.datetime);
  return ok({ synced: true }, 'RTC time synced');
}
