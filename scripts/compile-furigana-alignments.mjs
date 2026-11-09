// Regenerate from the pinned official ZIP: node scripts/compile-furigana-alignments.mjs path/to/JmdictFurigana.json.zip
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { unzipSync, strFromU8 } from 'fflate';

const sha256 = 'c4016e14be5adad5d9f28e941411c814c2f9234084ccdaf8caa095a7b27ae076';
const zip = await readFile(process.argv[2]);
if (createHash('sha256').update(zip).digest('hex') !== sha256) throw new Error('Unexpected dictionary version.');
const original = JSON.parse(strFromU8(unzipSync(zip)['JmdictFurigana.json']).replace(/^\uFEFF/, ''));
const entries = [];
const seen = new Set();
for (const entry of original) {
  if (!/^[\p{Script=Han}々〆]{2,}$/u.test(entry.text)) continue;
  const parts = entry.furigana.map(part => typeof part === 'string' ? [part] : [part.ruby, part.rt]);
  if (parts.length < 2 || parts.map(part => part[0]).join('') !== entry.text || parts.map(part => part[1] || part[0]).join('') !== entry.reading) continue;
  const key = `${entry.text}\0${entry.reading}`;
  if (seen.has(key)) continue;
  seen.add(key);
  entries.push([entry.text, entry.reading, parts]);
}
entries.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1);
const content = JSON.stringify({ source: 'JmdictFurigana 2.3.1+2026-03-25', license: 'CC BY-SA 4.0', entries });
const compressed = gzipSync(content, { level: 9 });
await writeFile(new URL('../public/furigana/alignments-v1.json.gz', import.meta.url), compressed);
console.log(`${entries.length} word/readings; ${compressed.length} compressed bytes`);
