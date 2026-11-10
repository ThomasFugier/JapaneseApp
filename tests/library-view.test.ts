import test from 'node:test';
import assert from 'node:assert/strict';
import { seedSnapshot } from '../lib/seed';
import { defaultReadingContext, deckAncestors, LIBRARY_BATCH_SIZE, libraryDisplayCount, libraryNotes, noteDecks, sanitizeReadingContext, updateReadingContext } from '../lib/library-view';

test('dictionary search follows the selected deck without duplicate notes', () => {
  const data = seedSnapshot();
  assert.equal(libraryNotes(data, { ...defaultReadingContext, search: 'WRITE' })[0]?.japanese, '書く');
  assert.equal(libraryNotes(data, { ...defaultReadingContext, search: 'たべる' })[0]?.japanese, '食べる');
  assert.equal(libraryNotes(data, { ...defaultReadingContext, deckId: 'kanjis', search: 'to eat' }).length, 0);
  const found = libraryNotes(data, { ...defaultReadingContext, deckId: null, search: 'to eat' });
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
  const context = { ...defaultReadingContext, deckId: 'travail', search: 'écrire', sort: 'added' as const, hideTranslations: true, expanded: 'note-kaku', scrollY: 360 };
  assert.deepEqual(sanitizeReadingContext(context), context);
});

test('legacy global scope cannot override the deck restored from browser storage', () => {
  const data = seedSnapshot();
  const context = sanitizeReadingContext({ ...defaultReadingContext, deckId: 'kanjis', search: 'to eat', scope: 'all' });
  assert.equal(context.deckId, 'kanjis');
  assert.equal(libraryNotes(data, context).length, 0);
});

function largeLibrary() {
  const data = seedSnapshot();
  const note = data.notes[0], card = data.cards[0];
  data.notes = Array.from({ length: 235 }, (_, i) => ({ ...note, id: `page-note-${i}`, japanese: `語${i}`, reading: `ご${i}`, meaning: i === 234 ? 'target beyond page' : `fixture item ${i}` }));
  data.cards = data.notes.map(note => ({ ...card, id: `${note.id}:ja-fr`, noteId: note.id }));
  data.reviews = []; data.reviewUndos = [];
  return data;
}

test('successive library batches retain stable order without duplicates or missing tail cards', () => {
  const notes = libraryNotes(largeLibrary(), defaultReadingContext);
  let context = { ...defaultReadingContext };
  const seen = new Set<string>();
  let previous = 0;
  for (const expected of [100, 200, 235]) {
    const count = libraryDisplayCount(notes, context.visibleCount);
    assert.equal(count, expected);
    for (const note of notes.slice(previous, count)) { assert.ok(!seen.has(note.id)); seen.add(note.id); }
    previous = count;
    context = updateReadingContext(context, { visibleCount: context.visibleCount + LIBRARY_BATCH_SIZE });
  }
  assert.deepEqual([...seen], notes.map(note => note.id));
});

test('search still finds a card beyond the displayed prefix and starts a fresh batch', () => {
  const data = largeLibrary();
  const context = updateReadingContext({ ...defaultReadingContext, visibleCount: 300, scrollY: 8000 }, { search: 'target beyond page' });
  const results = libraryNotes(data, context);
  assert.deepEqual(results.map(note => note.id), ['page-note-234']);
  assert.equal(context.visibleCount, 100);
  assert.equal(context.scrollY, 0);
  assert.equal(libraryDisplayCount(results, context.visibleCount), 1);
});

test('loaded batches survive preference storage and reset only when the library scope changes', () => {
  const context = { ...defaultReadingContext, visibleCount: 300, scrollY: 7800 };
  assert.deepEqual(sanitizeReadingContext(JSON.parse(JSON.stringify(context))), context);
  assert.equal(updateReadingContext(context, { hideTranslations: true, expanded: 'page-note-150' }).visibleCount, 300);
  for (const patch of [{ search: 'go' }, { deckId: 'travail' }, { sort: 'meaning' as const }]) {
    const next = updateReadingContext(context, patch);
    assert.equal(next.visibleCount, 100);
    assert.equal(next.scrollY, 0);
  }
  assert.equal(updateReadingContext(context, { sort: context.sort }).visibleCount, 300);
});

test('editor and expanded-card anchors remain reachable across batch boundaries', () => {
  const notes = libraryNotes(largeLibrary(), defaultReadingContext);
  assert.equal(libraryDisplayCount(notes, 100, [notes[99].id]), 100);
  assert.equal(libraryDisplayCount(notes, 100, [notes[100].id]), 200);
  assert.equal(libraryDisplayCount(notes, 100, [notes[100].id, notes[234].id]), 235);
  assert.equal(libraryDisplayCount(notes, 100, ['outside-current-results']), 100);
});

test('legacy and malformed batch preferences cannot hide cards or create unbounded page sizes', () => {
  for (const visibleCount of [undefined, null, '', '300', -100, 0, Infinity, NaN]) assert.equal(sanitizeReadingContext({ visibleCount }).visibleCount, 100);
  assert.equal(sanitizeReadingContext({ visibleCount: 101 }).visibleCount, 200);
  assert.equal(sanitizeReadingContext({ visibleCount: 10000000 }).visibleCount, 20000);
  assert.equal(libraryDisplayCount([], 300), 0);
});
