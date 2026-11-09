import { validateSnapshot, type Note, type Snapshot } from './model';

export function updateNoteContent(data: Snapshot, content: Note): Snapshot {
  const original = data.notes.find(note => note.id === content.id && !note.deletedAt);
  if (!original) throw new Error('This card is no longer available.');
  const updated: Note = {
    ...original,
    japanese: content.japanese, reading: content.reading,
    ...(content.onReadings === undefined ? {} : { onReadings: content.onReadings }),
    ...(content.kunReadings === undefined ? {} : { kunReadings: content.kunReadings }),
    meaning: content.meaning, example: content.example,
    exampleTranslation: content.exampleTranslation, explanation: content.explanation,
    tags: content.tags, updatedAt: content.updatedAt,
  };
  return validateSnapshot({ ...data, notes: data.notes.map(note => note.id === updated.id ? updated : note) });
}
