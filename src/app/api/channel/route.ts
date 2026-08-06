import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { renameChannel } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';

export const runtime = 'nodejs';

// POST /api/channel { channelId, name }
// Rename a single channel (1..12). Name must be 1..32 chars after trim.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: { channelId?: number; name?: string };
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  const channelId = body.channelId;
  const name = body.name;
  if (typeof channelId !== 'number' || channelId < 1 || channelId > 12) {
    return fail('Invalid channelId (1-12)');
  }
  if (typeof name !== 'string') {
    return fail('name must be a string');
  }
  const trimmed = name.trim();
  if (trimmed.length < 1) return fail('name cannot be empty');
  if (trimmed.length > 32) return fail('name must be ≤ 32 chars');

  const success = renameChannel(channelId, trimmed);
  if (!success) return fail('Failed to rename channel');

  return ok(
    { channel: { id: channelId, name: trimmed } },
    'Channel renamed'
  );
}
