import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.dictionary-cache');
const output = path.join(root, 'public', 'conversation-dictionary', 'v1');
const release = '3.6.2+20261109214828';
const sources = [
  {
    name: `jmdict-fre-${release}.json.zip`,
    url: `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(release)}/jmdict-fre-${release}.json.zip`,
    sha256: '49034ff0ed2d1c68e389322036e81e8f5b723cb73f253fde8b0f6193c4b8e112',
    language: 'fre',
  },
  {
    name: `jmdict-eng-common-${release}.json.zip`,
    url: `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(release)}/jmdict-eng-common-${release}.json.zip`,
    sha256: '207285d41471718ed9bee65bad148f07b74b9e1109c712c39d0726e988123686',
    language: 'eng',
  },
  {
    name: `jmdict-eng-${release}.json.zip`,
    url: `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(release)}/jmdict-eng-${release}.json.zip`,
    sha256: '6499b5ff4f6c57878a9e01e4df8d2c33ab1a8a3d649ca64e9b45d3885d645fb6',
    language: 'eng',
    filterGrammar: true,
  },
];
const shardCount = 64;

async function sourceData(source) {
  await mkdir(cache, { recursive: true });
  const archivePath = path.join(cache, source.name);
  let archive;
  try { archive = await readFile(archivePath); }
  catch {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${source.url}`);
    archive = Buffer.from(await response.arrayBuffer());
    await writeFile(archivePath, archive);
  }
  const actual = createHash('sha256').update(archive).digest('hex');
  if (actual !== source.sha256) throw new Error(`SHA-256 mismatch for ${source.name}: ${actual}`);
  const files = unzipSync(new Uint8Array(archive));
  const jsonPath = Object.keys(files).find(name => name.endsWith('.json'));
  if (!jsonPath) throw new Error(`No JSON found in ${source.name}`);
  return JSON.parse(new TextDecoder().decode(files[jsonPath]));
}

function stableShard(word) {
  // FNV-1a 32-bit over Unicode code points; keep in sync with the lookup client.
  let hash = 0x811c9dc5;
  for (const character of word) {
    const point = character.codePointAt(0);
    hash = Math.imul(hash ^ (point & 0xff), 0x01000193);
    if (point > 0xff) hash = Math.imul(hash ^ (point >>> 8), 0x01000193);
    if (point > 0xffff) hash = Math.imul(hash ^ (point >>> 16), 0x01000193);
  }
  return (hash >>> 0) % shardCount;
}

function compactEntry(entry, language) {
  const kanji = (entry.kanji ?? []).map(item => item.text).filter(Boolean);
  const readings = (entry.kana ?? []).map(item => item.text).filter(Boolean);
  const senses = (entry.sense ?? []).map(sense => ({
    pos: [...new Set(sense.partOfSpeech ?? [])].slice(0, 8),
    gloss: (sense.gloss ?? []).filter(item => item.lang === language).map(item => item.text.trim()).filter(Boolean).slice(0, 3).map(text => text.slice(0, 200)),
  })).filter(sense => sense.gloss.length).slice(0, 3);
  return { id: String(entry.id), kanji: kanji.slice(0, 8), readings: readings.slice(0, 8), senses };
}

const dictionaries = await Promise.all(sources.map(async source => ({ source, data: await sourceData(source) })));
const byWord = Array.from({ length: shardCount }, () => new Map());
const preferredEntries = new Map();
for (const { source, data } of dictionaries) {
  for (const raw of data.words ?? []) {
    if (source.filterGrammar && !(raw.sense ?? []).some(sense => (sense.partOfSpeech ?? []).some(pos => /^(prt|aux|cop)/.test(pos)))) continue;
    const entry = compactEntry(raw, source.language);
    if (!entry.readings.length || !entry.senses.length) continue;
    const keys = [...new Set([...(raw.kanji ?? []), ...(raw.kana ?? [])].map(item => item.text).filter(Boolean))];
    const previous = preferredEntries.get(entry.id);
    if (!previous || (previous.language === 'eng' && (source.language === 'fre' || source.filterGrammar))) {
      preferredEntries.set(entry.id, { ...entry, language: source.language, keys: [...new Set([...(previous?.keys ?? []), ...keys])] });
    } else {
      previous.keys = [...new Set([...previous.keys, ...keys])];
    }
  }
}
for (const entry of preferredEntries.values()) {
    for (const key of entry.keys) {
      const shard = byWord[stableShard(key)];
      const records = shard.get(key) ?? [];
      const { keys: _keys, ...record } = entry;
      records.push(record);
      shard.set(key, records);
    }
}

await mkdir(output, { recursive: true });
for (let index = 0; index < shardCount; index++) {
  const records = Object.fromEntries([...byWord[index]].sort(([a], [b]) => a.localeCompare(b, 'ja')));
  await writeFile(path.join(output, `${index.toString(16).padStart(2, '0')}.json`), `${JSON.stringify(records)}\n`);
}
await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify({
  version: 1,
  shardCount,
  shardAlgorithm: 'FNV-1a-32-codepoints-v1',
  schema: '{[headwordOrReading]: [{id,kanji:string[],readings:string[],senses:[{pos:string[],gloss:string[]}],language:"fre"|"eng"}]}',
  sources: sources.map(({ name, url, sha256, language }) => ({ name, url, sha256, language })),
  entryCount: preferredEntries.size,
  policy: 'French entry preferred per JMdict id; common English used when French is absent; full English grammatical entries (participle, auxiliary, copula POS) are included, replacing same-ID English common entries only. Up to 8 headwords/readings, 3 senses, 8 POS labels and 3 glosses per sense; glosses capped at 200 characters.',
  note: 'Entries are lookup candidates; prefer French glosses, then English. Dictionary senses are not sentence translations.',
}, null, 2)}\n`);
console.log(`Prepared ${preferredEntries.size} entries in ${shardCount} shards at ${path.relative(root, output)}`);
