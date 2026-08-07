import { getSession } from '@/lib/auth';
import { ok } from '@/lib/apiResponse';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  return ok(session);
}
