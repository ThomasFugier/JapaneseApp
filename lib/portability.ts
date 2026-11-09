import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { validateSnapshot, type Snapshot } from './model';

const MAX_BYTES = 20 * 1024 * 1024;

export function backupBytes(snapshot: Snapshot): Uint8Array {
  const data = validateSnapshot(snapshot);
  const json = strToU8(JSON.stringify(data, null, 2));
  if (json.byteLength > MAX_BYTES) throw new Error('The backup exceeds the 20 MB limit for this version.');
  const bytes = zipSync({
    'kotoba.json': json,
    'README.txt': strToU8('Japanese — complete backup, format 3\nThe kotoba.json file contains notes, cards, decks, deck assignments, reviews, and undo records.\nIDs are stable. Dates use ISO 8601.\nThis version does not support media.\n'),
  });
  if (bytes.byteLength > MAX_BYTES) throw new Error('The backup exceeds the 20 MB limit for this version.');
  return bytes;
}

export function readBackup(bytes: Uint8Array): Snapshot {
  if (bytes.byteLength > MAX_BYTES) throw new Error('The file exceeds 20 MB.');
  let text: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes, { filter(file) {
      if (file.name !== 'kotoba.json') return false;
      if (file.originalSize > MAX_BYTES) throw new Error('The uncompressed backup exceeds 20 MB.');
      return true;
    } });
    if (!files['kotoba.json']) throw new Error('The ZIP does not contain kotoba.json.');
    text = strFromU8(files['kotoba.json']);
  } else text = strFromU8(bytes);
  if (text.length > MAX_BYTES) throw new Error('The backup is too large.');
  try { return validateSnapshot(JSON.parse(text)); }
  catch (error) { throw new Error(error instanceof SyntaxError ? 'The JSON file cannot be read.' : (error as Error).message); }
}

export function csvText(snapshot: Snapshot): string {
  const escape = (value: string) => {
    // Quoting alone does not stop spreadsheets interpreting imported text as formulas.
    const safe = /^[\t\r\n]|^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const activeCards = snapshot.cards.filter((c) => !c.deletedAt);
  const rows = snapshot.notes.filter((n) => !n.deletedAt).map((note) => {
    const decks = [...new Set(activeCards.filter((c) => c.noteId === note.id).flatMap((c) => c.deckIds))]
      .map((id) => snapshot.decks.find((d) => d.id === id && !d.deletedAt)?.name).filter(Boolean).join(' | ');
    return [note.id, note.japanese, note.reading, note.meaning, note.example, note.exampleTranslation, note.explanation, note.tags.join(' | '), decks, (note.onReadings ?? []).join(' | '), (note.kunReadings ?? []).join(' | ')].map(escape).join(',');
  });
  return '\uFEFF' + ['id,japanese,reading,meaning,example,example_translation,explanation,tags,decks,on_readings,kun_readings', ...rows].join('\r\n');
}

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBackup(snapshot: Snapshot): void {
  download(backupBytes(snapshot), `japanese-${new Date().toISOString().slice(0, 10)}.zip`, 'application/zip');
}

export function downloadCsv(snapshot: Snapshot): void {
  download(strToU8(csvText(snapshot)), `japanese-notes-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
}

export async function parseImport(file: File): Promise<Snapshot> {
  if (file.size > MAX_BYTES) throw new Error('The file exceeds 20 MB.');
  return readBackup(new Uint8Array(await file.arrayBuffer()));
}
