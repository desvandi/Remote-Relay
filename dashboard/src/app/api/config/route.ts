import { requireAuth, verifyCsrfToken } from '@/lib/auth';
import { getStore, exportConfig } from '@/lib/mockStore';
import { ok, fail, unauthorized } from '@/lib/apiResponse';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return unauthorized(auth.message);
  await getStore();
  const cfg = exportConfig();
  return ok(cfg);
}
