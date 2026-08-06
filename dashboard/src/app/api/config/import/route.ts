import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { importConfig } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';
import type { SystemConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: Partial<SystemConfig>;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (!body.channels || !body.schedules || !body.pirs) {
    return fail('Missing required config fields');
  }
  const success = importConfig(body);
  if (!success) return fail('Failed to import config');
  return ok({ imported: true }, 'Configuration imported');
}
