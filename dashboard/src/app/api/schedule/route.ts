import { NextRequest } from 'next/server';
import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { upsertSchedule, deleteSchedule, getStore } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';
import type { Schedule } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  let body: Schedule;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }
  // Basic validation
  if (!body.channelId || body.channelId < 1 || body.channelId > 12) {
    return fail('Invalid channelId');
  }
  if (!/^\d{2}:\d{2}$/.test(body.onTime) || !/^\d{2}:\d{2}$/.test(body.offTime)) {
    return fail('Invalid time format (use HH:MM)');
  }
  if (body.dayMask < 0 || body.dayMask > 0x7F) {
    return fail('Invalid dayMask (0-127)');
  }
  const success = upsertSchedule(body);
  if (!success) return fail('Schedule limit reached (max 4 per channel)');
  const store = await getStore();
  const sched = store.schedules.find((s) =>
    body.id ? s.id === body.id : s.onTime === body.onTime && s.offTime === body.offTime && s.channelId === body.channelId
  )!;
  return ok({ schedule: sched }, 'Schedule saved');
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);

  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return fail('Missing schedule id');
  const success = deleteSchedule(id);
  if (!success) return fail('Schedule not found', 404);
  return ok({ deleted: true }, 'Schedule deleted');
}
