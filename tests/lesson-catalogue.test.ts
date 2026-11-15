import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonCatalogue, LESSON_PAGE_SIZE, type LessonSort, type LessonStatus } from '../lib/lesson-catalogue';

const lessons = Array.from({ length: 100 }, (_, index) => ({
  id: `lesson-${index}`, category: index < 50 ? 'Grammaire' : 'Conjugaison',
  title: `Leçon ${index + 1}`, japanese: index === 0 ? 'ほうが・より' : 'たい',
  description: index === 0 ? 'Comparer des préférences' : 'Exprimer une envie',
}));
const options = { query: '', category: 'all', status: 'all' as LessonStatus, sort: 'course' as LessonSort, page: 1 };

test('50 lessons per category stay bounded and every lesson is reachable once', () => {
  const first = lessonCatalogue(lessons, [], [], options);
  assert.equal(first.total, 100);
  assert.equal(first.items.length, LESSON_PAGE_SIZE);
  const ids = Array.from({ length: first.pageCount }, (_, index) => lessonCatalogue(lessons, [], [], { ...options, page: index + 1 }).items).flat().map(item => item.id);
  assert.equal(ids.length, 100);
  assert.equal(new Set(ids).size, 100);
  assert.equal(lessonCatalogue(lessons, [], [], { ...options, category: 'Grammaire' }).total, 50);
});

test('search matches French accents, Japanese and combined words without changing source order', () => {
  assert.equal(lessonCatalogue(lessons, [], [], { ...options, query: 'PREFERENCES grammaire' }).items[0].id, 'lesson-0');
  assert.equal(lessonCatalogue(lessons, [], [], { ...options, query: 'ほうが' }).total, 1);
  assert.equal(lessonCatalogue(lessons, [], [], { ...options, query: 'envie', category: 'Conjugaison' }).total, 50);
  assert.equal(lessons[0].id, 'lesson-0');
});

test('validation filters compose with categories and clamp a page after results shrink', () => {
  const checked = ['lesson-0', 'lesson-50'];
  const done = lessonCatalogue(lessons, checked, [], { ...options, status: 'validated', category: 'Conjugaison', page: 9 });
  assert.deepEqual(done.items.map(item => item.id), ['lesson-50']);
  assert.equal(done.page, 1);
  assert.equal(lessonCatalogue(lessons, checked, [], { ...options, status: 'pending', category: 'Grammaire' }).total, 49);
});

test('review priority and French title sorting are stable without mutating lessons', () => {
  assert.deepEqual(lessonCatalogue(lessons, [], ['lesson-51', 'lesson-4'], { ...options, sort: 'review' }).items.slice(0, 3).map(item => item.id), ['lesson-51', 'lesson-4', 'lesson-0']);
  const titles = lessonCatalogue(lessons.slice().reverse(), [], [], { ...options, sort: 'title' }).items.map(item => item.title);
  assert.deepEqual(titles.slice(0, 3), ['Leçon 1', 'Leçon 2', 'Leçon 3']);
  assert.equal(lessons[0].id, 'lesson-0');
});

test('empty results and out of range pages have usable navigation bounds', () => {
  const empty = lessonCatalogue(lessons, [], [], { ...options, query: 'absent', page: 20 });
  assert.deepEqual(empty.items, []);
  assert.equal(empty.page, 1);
  assert.equal(empty.pageCount, 1);
  assert.equal(lessonCatalogue(lessons, [], [], { ...options, page: -3 }).page, 1);
  const last = lessonCatalogue(lessons, [], [], { ...options, page: 999 });
  assert.equal(last.page, last.pageCount);
  assert.equal(last.items.at(-1)?.id, 'lesson-99');
});
