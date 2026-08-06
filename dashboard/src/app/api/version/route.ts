import { requireAuth } from '@/lib/auth';
import { getStore } from '@/lib/mockStore';
import { ok, unauthorized } from '@/lib/apiResponse';
import type { FirmwareInfo } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  await getStore();
  // getFirmwareInfo is imported lazily to avoid circular
  const { getFirmwareInfo } = await import('@/lib/mockStore');
  const info: FirmwareInfo = getFirmwareInfo();
  return ok(info);
}
