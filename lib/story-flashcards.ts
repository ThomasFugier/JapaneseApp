import { validateSnapshot, type Snapshot, type Note } from './model';
import { findDuplicateNote } from './note-similarity';
import { bulkLibraryAction } from './library-actions';
import type { Story, StoryWord } from './stories';

export type StoryFlashcardDraft = { word: StoryWord; example: string; story: Pick<Story, 'subtitle' | 'title' | 'level'> };

export function addStoryFlashcard(snapshot: Snapshot, draft: StoryFlashcardDraft, deckId: string | null, now = new Date().toISOString(), id: string = crypto.randomUUID()): Snapshot {
  if (deckId && !snapshot.decks.some(deck => deck.id === deckId && !deck.deletedAt)) throw new Error('Ce deck n’est plus disponible. Choisis un autre deck.');
  const word = { japanese: draft.word.text.trim(), reading: draft.word.reading.trim(), meaning: draft.word.meaning.trim() };
  const existing = findDuplicateNote(snapshot, word);
  if (existing) {
    if (!deckId || snapshot.cards.filter(card => card.noteId === existing.id && !card.deletedAt).every(card => card.deckIds.includes(deckId))) return snapshot;
    return bulkLibraryAction(snapshot, [existing.id], { type: 'add-deck', deckId }, now);
  }
  const note: Note = {
    id, ...word, example: draft.example, exampleTranslation: '',
    explanation: `Histoire : ${draft.story.subtitle} (${draft.story.title}) · ${draft.story.level}`,
    tags: ['Histoires', draft.story.level], createdAt: now, updatedAt: now,
  };
  const cards = (['ja-fr', 'fr-ja'] as const).map(direction => ({ id: `${id}:${direction}`, noteId: id, direction, deckIds: deckId ? [deckId] : [], updatedAt: now }));
  return validateSnapshot({ ...snapshot, notes: [...snapshot.notes, note], cards: [...snapshot.cards, ...cards] });
}
