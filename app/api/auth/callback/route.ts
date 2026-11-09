import { cookies } from 'next/headers';
import { requireConfig } from '@/lib/server/config';
import { OAUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, equalTokens, signPayload, verifyPayload } from '@/lib/server/session';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  let appUrl = '/';
  try {
    const config = requireConfig(); appUrl = config.appUrl;
    const jar = await cookies();
    const attempt = verifyPayload<{ state: string; verifier: string; exp: number }>(jar.get(OAUTH_COOKIE)?.value, config.secret);
    jar.set(OAUTH_COOKIE, '', cookieOptions(config, 0));
    const query = new URL(request.url).searchParams;
    const code = query.get('code'); const state = query.get('state');
    if (!attempt || !state || !equalTokens(state, attempt.state) || !code || code.length > 512) throw new Error('Invalid authorization');
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: `${config.appUrl}/api/auth/callback`, code_verifier: attempt.verifier }),
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok) throw new Error('Authorization failed');
    const tokens = await tokenResponse.json();
    if (typeof tokens.access_token !== 'string') throw new Error('No token');
    const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!userResponse.ok) throw new Error('Identity failed');
    const user = await userResponse.json();
    if (typeof user.login !== 'string' || user.login.toLowerCase() !== config.allowedUser.toLowerCase() || !Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('Owner mismatch');
    jar.set(SESSION_COOKIE, signPayload({ login: user.login, userId: user.id, exp: Date.now() + SESSION_MAX_AGE * 1000 }, config.secret), cookieOptions(config, SESSION_MAX_AGE));
    return Response.redirect(`${config.appUrl}/?auth=success`, 302);
  } catch {
    // Never reflect OAuth provider errors, authorization codes, or tokens.
    return new Response(null, { status: 302, headers: { Location: `${appUrl === '/' ? '' : appUrl}/?auth=error`, 'Cache-Control': 'no-store' } });
  }
}
