import type { CloudConnectionStatus } from '@/lib/cloud-connection';
import { getConfig, getRepositoryMetadata } from '@/lib/server/config';
import { json } from '@/lib/server/http';
import { getSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export async function GET() {
  const config = getConfig();
  const metadata = getRepositoryMetadata();
  if (!config) return json({ ...metadata, configured: false, authenticated: false, reason: 'Local mode: GitHub synchronization is not configured.' } satisfies CloudConnectionStatus);
  const session = await getSession(config);
  return json({ ...metadata, configured: true, authenticated: !!session, ...(session ? { user: { login: session.login } } : {}) } satisfies CloudConnectionStatus);
}
