import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { requireConfig } from '@/lib/server/config';
import { errorResponse } from '@/lib/server/http';
import { OAUTH_COOKIE, cookieOptions, randomToken, signPayload } from '@/lib/server/session';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const config = requireConfig();
    const state = randomToken(); const verifier = randomToken();
    const jar = await cookies();
    jar.set(OAUTH_COOKIE, signPayload({ state, verifier, exp: Date.now() + 600000 }, config.secret), cookieOptions(config, 600));
    const target = new URL('https://github.com/login/oauth/authorize');
    target.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${config.appUrl}/api/auth/callback`, scope: 'read:user', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    return Response.redirect(target, 302);
  } catch (error) { return errorResponse(error); }
}
