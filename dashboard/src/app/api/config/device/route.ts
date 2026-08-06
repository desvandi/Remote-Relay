import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { getStore, updateDeviceConfig } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: { deviceName?: string; timezone?: string };
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (body.deviceName !== undefined && (body.deviceName.length < 1 || body.deviceName.length > 32)) {
    return fail('Device name must be 1-32 characters');
  }
  const success = updateDeviceConfig({
    deviceName: body.deviceName,
    timezone: body.timezone,
  });
  if (!success) return fail('Failed to update device config');
  const store = await getStore();
  return ok({ updated: true, deviceName: store.deviceName, timezone: store.timezone }, 'Device config updated');
}
