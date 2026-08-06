import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { updatePIRConfig, getStore } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: { id: number; enabled?: boolean; holdTime?: number };
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (!body.id || body.id < 1 || body.id > 4) {
    return fail('Invalid PIR id (1-4)');
  }
  if (body.holdTime !== undefined && (body.holdTime < 5 || body.holdTime > 600)) {
    return fail('Hold time must be 5-600 seconds');
  }
  const success = updatePIRConfig(body.id, {
    enabled: body.enabled,
    holdTime: body.holdTime,
  });
  if (!success) return fail('Failed to update PIR config');
  const store = await getStore();
  const pir = store.pirs.find((p) => p.id === body.id)!;
  return ok({ pir }, 'PIR config updated');
}
