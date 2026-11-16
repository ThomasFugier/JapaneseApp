import { validateSnapshot, type Snapshot } from './model';

export function toggleCardReading(data: Snapshot, cardId: string, now = new Date().toISOString()): Snapshot {
  const card = data.cards.find(item => item.id === cardId && !item.deletedAt);
  if (!card || !data.notes.some(note => note.id === card.noteId && !note.deletedAt)) throw new Error('This card is no longer available.');
  if (card.direction !== 'ja-fr') throw new Error('Reading hints are only available on Japanese prompts.');
  return validateSnapshot({ ...data, cards: data.cards.map(item => item.id === cardId ? { ...item, showReading: !item.showReading, updatedAt: now } : item) });
}
