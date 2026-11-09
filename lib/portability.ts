import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { validateSnapshot, type Snapshot } from './model';

const MAX_BYTES = 20 * 1024 * 1024;

export function backupBytes(snapshot: Snapshot): Uint8Array {
  const data = validateSnapshot(snapshot);
  const json = strToU8(JSON.stringify(data, null, 2));
  if (json.byteLength > MAX_BYTES) throw new Error('La sauvegarde dépasse la limite de 20 Mo de cette version.');
  const bytes = zipSync({
    'kotoba.json': json,
    'README.txt': strToU8('Kotoba — sauvegarde complète, format 3\nLe fichier kotoba.json contient les fiches, cartes, decks, classements, révisions et annulations.\nLes identifiants sont stables. Les dates sont ISO 8601.\nAucun média n’est géré par cette version.\n'),
  });
  if (bytes.byteLength > MAX_BYTES) throw new Error('La sauvegarde dépasse la limite de 20 Mo de cette version.');
  return bytes;
}

export function readBackup(bytes: Uint8Array): Snapshot {
  if (bytes.byteLength > MAX_BYTES) throw new Error('Le fichier dépasse 20 Mo.');
  let text: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes, { filter(file) {
      if (file.name !== 'kotoba.json') return false;
      if (file.originalSize > MAX_BYTES) throw new Error('La sauvegarde décompressée dépasse 20 Mo.');
      return true;
    } });
    if (!files['kotoba.json']) throw new Error('Le ZIP ne contient pas kotoba.json.');
    text = strFromU8(files['kotoba.json']);
  } else text = strFromU8(bytes);
  if (text.length > MAX_BYTES) throw new Error('La sauvegarde est trop volumineuse.');
  try { return validateSnapshot(JSON.parse(text)); }
  catch (error) { throw new Error(error instanceof SyntaxError ? 'Le fichier JSON est illisible.' : (error as Error).message); }
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
  return '\uFEFF' + ['id,japonais,lecture,traduction,exemple,traduction_exemple,explication,tags,decks,lectures_on,lectures_kun', ...rows].join('\r\n');
}

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBackup(snapshot: Snapshot): void {
  download(backupBytes(snapshot), `kotoba-${new Date().toISOString().slice(0, 10)}.zip`, 'application/zip');
}

export function downloadCsv(snapshot: Snapshot): void {
  download(strToU8(csvText(snapshot)), `kotoba-cartes-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
}

export async function parseImport(file: File): Promise<Snapshot> {
  if (file.size > MAX_BYTES) throw new Error('Le fichier dépasse 20 Mo.');
  return readBackup(new Uint8Array(await file.arrayBuffer()));
}
