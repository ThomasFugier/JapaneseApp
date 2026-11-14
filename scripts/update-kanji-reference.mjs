// Refresh the bundled reference monthly from the original KANJIDIC2 data.
// Usage: node scripts/update-kanji-reference.mjs [path-to-kanjidic2.xml.gz]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const source = 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz';
const compressed = process.argv[2] ? await readFile(process.argv[2]) : await (async () => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Dictionary download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
})();
const xml = gunzipSync(compressed).toString('utf8');
const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => entity.startsWith('#') ? String.fromCodePoint(entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]);
const values = (block, pattern) => [...block.matchAll(pattern)].map(match => decode(match[1]));
const entries = [];
for (const match of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
  const block = match[1];
  const grade = Number(values(block, /<grade>(\d+)<\/grade>/g)[0]);
  if (!(grade >= 1 && grade <= 6) && grade !== 8) continue;
  entries.push({ character: values(block, /<literal>(.*?)<\/literal>/g)[0], grade,
    strokes: Number(values(block, /<stroke_count>(\d+)<\/stroke_count>/g)[0]),
    meanings: values(block, /<meaning>(.*?)<\/meaning>/g),
    on: values(block, /<reading r_type="ja_on">(.*?)<\/reading>/g),
    kun: values(block, /<reading r_type="ja_kun">(.*?)<\/reading>/g),
  });
}
if (entries.length !== 2136 || new Set(entries.map(entry => entry.character)).size !== 2136 || entries.some(entry => !entry.character || !entry.meanings.length || !entry.strokes)) throw new Error('Unexpected KANJIDIC2 structure; existing data kept.');
entries.sort((a, b) => a.grade - b.grade || a.strokes - b.strokes || a.character.codePointAt(0) - b.character.codePointAt(0));
await mkdir(new URL('../public/reference/', import.meta.url), { recursive: true });
await writeFile(new URL('../lib/kanji-reference.json', import.meta.url), JSON.stringify(entries) + '\n');
await writeFile(new URL('../public/reference/NOTICE.txt', import.meta.url), `KANJIDIC2 reference data\n\nCopyright Electronic Dictionary Research and Development Group (EDRDG).\nSource: ${source}\nDictionary date: ${values(xml, /<date_of_creation>(.*?)<\/date_of_creation>/g)[0]}\nSource SHA-256: ${createHash('sha256').update(compressed).digest('hex')}\n\nLicensed under Creative Commons Attribution-ShareAlike 4.0:\nhttps://creativecommons.org/licenses/by-sa/4.0/\nhttps://www.edrdg.org/edrdg/licence.html\n\nChanges: selected the 2,136 joyo characters (grades 1-6 and 8), retained\nEnglish meanings, on/kun readings, school grade and stroke count, converted\nto JSON and sorted by grade/stroke count. This derived data remains CC BY-SA 4.0.\nMachine-readable copy: /reference/kanji.json\nThe software UI is separate from this dictionary dataset.\n\nMaintainers: refresh monthly with node scripts/update-kanji-reference.mjs.\n`);
await writeFile(new URL('../public/reference/kanji.json', import.meta.url), JSON.stringify(entries) + '\n');
console.log(`Updated ${entries.length} kanji from KANJIDIC2.`);
