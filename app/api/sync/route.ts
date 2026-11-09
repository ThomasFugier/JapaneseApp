import { requireConfig } from '@/lib/server/config';
import { requireSession } from '@/lib/server/session';
import { GitHubStore } from '@/lib/server/github';
import { assertOrigin, boundedJson, errorResponse, HttpError, json } from '@/lib/server/http';
import { validateSnapshot } from '@/lib/model';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const config = requireConfig(); await requireSession(config);
    return json(await new GitHubStore(config).read());
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const config = requireConfig(); assertOrigin(request, config.appUrl); await requireSession(config);
    const body = await boundedJson(request);
    let base, snapshot;
    try {
      if (!body || typeof body !== 'object') throw new Error('Invalid envelope');
      const input = body as { base?: unknown; snapshot?: unknown };
      base = validateSnapshot(input.base); snapshot = validateSnapshot(input.snapshot);
    } catch { throw new HttpError(400, 'Invalid library format. No remote data was changed.'); }
    const result = await new GitHubStore(config).synchronize(base, snapshot);
    return json(result, result.conflict ? 409 : 200);
  } catch (error) { return errorResponse(error); }
}
