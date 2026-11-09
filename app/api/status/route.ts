import { getConfig } from '@/lib/server/config';
import { json } from '@/lib/server/http';
import { getSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export async function GET() {
  const config = getConfig();
  if (!config) return json({ configured: false, authenticated: false, reason: 'Local mode: GitHub synchronization is not configured.' });
  const session = await getSession(config);
  return json({ configured: true, authenticated: !!session, ...(session ? { user: { login: session.login } } : {}) });
}
