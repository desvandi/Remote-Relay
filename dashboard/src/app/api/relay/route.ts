import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { setRelayState, getStore } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';
import type { RelayMutation } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: RelayMutation;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (!body.channelId || body.channelId < 1 || body.channelId > 12) {
    return fail('Invalid channelId (1-12)');
  }
  if (!['toggle', 'on', 'off', 'set_mode'].includes(body.action)) {
    return fail('Invalid action');
  }
  const ok2 = setRelayState(body.channelId, body.action, {
    mode: body.mode,
    manualState: body.manualState,
  });
  if (!ok2) return fail('Failed to update relay');
  const store = await getStore();
  const channel = store.channels.find((c) => c.id === body.channelId)!;
  return ok({ channel }, 'Relay updated');
}
