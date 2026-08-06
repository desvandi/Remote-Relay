import { destroySession } from '@/lib/auth';
import { ok } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function POST() {
  await destroySession();
  return ok({ success: true }, 'Logged out');
}
