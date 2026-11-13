import { requireConfig } from '@/lib/server/config';
import { requireSession } from '@/lib/server/session';
import { GitHubStore } from '@/lib/server/github';
import { assertOrigin, boundedJson, errorResponse, json } from '@/lib/server/http';
import { parseSyncInput } from '@/lib/server/sync-input';

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
    const { base, snapshot } = parseSyncInput(body);
    const result = await new GitHubStore(config).synchronize(base, snapshot);
    return json(result, result.conflict ? 409 : 200);
  } catch (error) { return errorResponse(error); }
}
