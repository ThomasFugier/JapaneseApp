import { cookies } from 'next/headers';
import { requireConfig } from '@/lib/server/config';
import { assertOrigin, errorResponse, json } from '@/lib/server/http';
import { SESSION_COOKIE, cookieOptions } from '@/lib/server/session';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const config = requireConfig(); assertOrigin(request, config.appUrl);
    (await cookies()).set(SESSION_COOKIE, '', cookieOptions(config, 0));
    return json({ success: true });
  } catch (error) { return errorResponse(error); }
}
