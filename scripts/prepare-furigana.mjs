import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve('kuromoji/package.json'));
const destination = new URL('../public/furigana/kuromoji-0.1.2/', import.meta.url);
await mkdir(new URL('dict/', destination), { recursive: true });
await copyFile(path.join(source, 'build/kuromoji.js'), new URL('kuromoji.js', destination));
for (const file of ['LICENSE-2.0.txt', 'NOTICE.md']) await copyFile(path.join(source, file), new URL(file, destination));
for (const file of await readdir(path.join(source, 'dict'))) {
  if (file.endsWith('.dat.gz')) await copyFile(path.join(source, 'dict', file), new URL(`dict/${file}`, destination));
}
