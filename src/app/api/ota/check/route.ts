import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { getFirmwareInfo } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

// POST /api/ota/check — check GitHub Release for newer firmware
// audit-fixes: added CSRF check (was inconsistent with other POST mutations).
//   Although this endpoint only reads mock state and doesn't trigger any
//   side effect, it's still a POST that requires auth — CSRF contract
//   should be uniform across all authed POSTs.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

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
