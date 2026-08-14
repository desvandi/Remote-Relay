import { NextRequest, NextResponse } from 'next/server';
import { destroySession, verifyCsrfToken } from '@/lib/auth';
import { ok, fail } from '@/lib/apiResponse';

export const runtime = 'nodejs';

// POST /api/logout
// audit-fixes: added CSRF check. Logout CSRF is a known attack vector —
//   an attacker who lures an authenticated user to a page that issues
//   fetch('/api/logout', { method: 'POST', credentials: 'include' })
//   could log the user out without their consent. Requiring the CSRF
//   token prevents this (the attacker's page cannot read the CSRF cookie
//   due to same-origin policy, so cannot forge the X-CSRF-Token header).
export async function POST(req: NextRequest) {
  if (!(await verifyCsrfToken(req))) return fail('Invalid CSRF token', 403);
  await destroySession();
  return ok({ success: true }, 'Logged out');
}
