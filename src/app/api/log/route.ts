import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLogsSnapshot } from '@/lib/mockStore';
import { ok, unauthorized } from '@/lib/apiResponse';
import type { LogType } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);

  const url = new URL(req.url);
  const type = url.searchParams.get('type') as LogType | 'all' | null;
  const channelIdParam = url.searchParams.get('channelId');
  const limitParam = url.searchParams.get('limit');

  let logs = getLogsSnapshot();
  if (type && type !== 'all') {
    logs = logs.filter((l) => l.type === type);
  }
  if (channelIdParam && channelIdParam !== 'all') {
    const chId = Number(channelIdParam);
    if (!isNaN(chId)) logs = logs.filter((l) => l.channelId === chId);
  }
  const limit = limitParam ? Number(limitParam) : 200;
  if (!isNaN(limit) && limit > 0) {
    logs = logs.slice(0, limit);
  }
  return ok({ logs, total: logs.length });
}
