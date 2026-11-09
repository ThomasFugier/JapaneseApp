import test from 'node:test';
import assert from 'node:assert/strict';
import { seedSnapshot } from '../lib/seed';
import { defaultReadingContext, deckAncestors, libraryNotes, noteDecks, sanitizeReadingContext } from '../lib/library-view';

test('dictionary search handles accents, Japanese and global scope without duplicate notes', () => {
  const data = seedSnapshot();
  assert.equal(libraryNotes(data, { ...defaultReadingContext, search: 'ECRIRE' })[0]?.japanese, '書く');
  assert.equal(libraryNotes(data, { ...defaultReadingContext, search: 'たべる' })[0]?.japanese, '食べる');
  assert.equal(libraryNotes(data, { ...defaultReadingContext, deckId: 'kanjis', search: 'Manger' }).length, 0);
  const found = libraryNotes(data, { ...defaultReadingContext, deckId: 'kanjis', search: 'Manger', scope: 'all' });
  assert.equal(found.length, 1);
  assert.equal(found[0].id, 'note-taberu');
  assert.equal(noteDecks(data, found[0].id).length, 3);
});

test('dictionary sort uses stable Japanese, French and creation-date order', () => {
  const data = seedSnapshot();
  data.notes[0].japanese = '亜'; data.notes[0].reading = 'あ';
  data.notes[1].japanese = '伊'; data.notes[1].reading = 'い';
  const japanese = libraryNotes(data, { ...defaultReadingContext });
  assert.ok(japanese.findIndex(note => note.id === data.notes[0].id) < japanese.findIndex(note => note.id === data.notes[1].id));
  data.notes[0].meaning = 'Écrire'; data.notes[1].meaning = 'Abc';
  const french = libraryNotes(data, { ...defaultReadingContext, sort: 'meaning' });
  assert.equal(french[0].id, data.notes[1].id);
  Object.assign(data.notes[0], { createdAt: '2026-11-09T09:00:00.000Z', updatedAt: '2026-11-09T12:00:00.000Z' });
  Object.assign(data.notes[1], { createdAt: '2026-11-09T10:00:00.000Z', updatedAt: '2026-11-09T10:00:00.000Z' });
  const added = libraryNotes(data, { ...defaultReadingContext, sort: 'added' });
  assert.equal(added[0].id, data.notes[1].id);
  assert.equal(added[1].id, data.notes[0].id);
  Object.assign(data.notes[0], { createdAt: '2026-11-09T10:00:00.000Z' });
  const tied = libraryNotes(data, { ...defaultReadingContext, sort: 'added' }).slice(0, 2).map(note => note.id);
  assert.deepEqual(tied, [...tied].sort());
});

test('breadcrumbs include active parents and exclude deleted or missing decks', () => {
  const data = seedSnapshot();
  assert.deepEqual(deckAncestors(data, 'travail').map(deck => deck.id), ['japonais', 'vocabulaire', 'verbes', 'travail']);
  data.decks.find(deck => deck.id === 'vocabulaire')!.deletedAt = '2026-11-09T12:00:00.000Z';
  assert.deepEqual(deckAncestors(data, 'travail').map(deck => deck.id), ['japonais', 'verbes', 'travail']);
  assert.deepEqual(deckAncestors(data, 'missing'), []);
});

test('Japanese dictionary sorts kanji entries by their kana reading', () => {
  const data = seedSnapshot();
  data.notes[0].japanese = '国'; data.notes[0].reading = 'くに';
  data.notes[1].japanese = '駅'; data.notes[1].reading = 'えき';
  const sorted = libraryNotes(data, { ...defaultReadingContext });
  assert.ok(sorted.findIndex(note => note.id === data.notes[1].id) < sorted.findIndex(note => note.id === data.notes[0].id));
});

test('reading context restores valid preferences and rejects malformed browser storage', () => {
  assert.deepEqual(sanitizeReadingContext(null), defaultReadingContext);
  assert.deepEqual(sanitizeReadingContext({ deckId: false, sort: 'unknown', hideTranslations: 'true', scrollY: Infinity }), defaultReadingContext);
  const context = { ...defaultReadingContext, deckId: 'travail', search: 'écrire', sort: 'added' as const, scope: 'all' as const, hideTranslations: true, expanded: 'note-kaku', scrollY: 360 };
  assert.deepEqual(sanitizeReadingContext(context), context);
});
