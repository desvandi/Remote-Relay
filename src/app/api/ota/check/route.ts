import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { getFirmwareInfo, getStore } from '@/lib/mockStore';
import { ok, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

// POST /api/ota/check — check GitHub Release for newer firmware
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);

  const info = getFirmwareInfo();
  return ok(
    {
      available: info.updateAvailable,
      latestVersion: info.latestAvailable,
      currentVersion: info.currentVersion,
    },
    info.updateAvailable ? 'Update available' : 'Firmware is up to date'
  );
}
