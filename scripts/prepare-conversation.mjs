import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Turbopack emits new URL(...worker.ts) as a raw asset in production.
// Ship a self-contained browser module, with no bare npm imports.
await build({
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  entryPoints: [fileURLToPath(new URL('../lib/conversation.worker.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../public/ai/conversation.worker.js', import.meta.url)),
  tsconfigRaw: {},
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'linked',
});
