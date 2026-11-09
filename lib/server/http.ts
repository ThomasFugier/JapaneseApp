export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  return json({ error: 'Opération impossible. Vos données locales sont conservées.' }, 500);
}

export function assertOrigin(request: Request, appUrl: string): void {
  if (request.headers.get('origin') !== new URL(appUrl).origin) throw new HttpError(403, 'Origine de la requête refusée.');
}

export async function boundedJson(request: Request, maxBytes = 4 * 1024 * 1024): Promise<unknown> {
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) throw new HttpError(415, 'Un document JSON est attendu.');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, 'Données trop volumineuses.');
  if (!request.body) throw new HttpError(400, 'Document JSON manquant.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'Données trop volumineuses.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Document JSON invalide.'); }
}
