import { isMockAuthEnabled } from '@/lib/mockStore';
import { ok } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function GET() {
  // When mock auth is disabled in production (MQTT-only deployment), return
  // an unauthenticated session instead of calling getSession() which would
  // attempt JWT verification with an empty secret. This keeps the PWA's
  // initial page-load session check fast and silent (no 500, no error toast).
  if (!isMockAuthEnabled()) {
    return ok({ isAuthenticated: false, username: null, expiresAt: null });
  }
  // Lazy import to avoid pulling JWT/crypto deps at module load when disabled.
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  return ok(session);
}
