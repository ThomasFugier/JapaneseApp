export const LESSON_PAGE_SIZE = 8;
export type LessonStatus = 'all' | 'pending' | 'validated';
export type LessonSort = 'course' | 'review' | 'title';

type CatalogueLesson = { id: string; category: string; title: string; japanese: string; description: string };
type Options = { query: string; category: string; status: LessonStatus; sort: LessonSort; page: number };
const titleOrder = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
const searchable = (value: string) => value.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

export function lessonCatalogue<T extends CatalogueLesson>(lessons: readonly T[], validatedIds: readonly string[], reviewOrder: readonly string[], options: Options) {
  const validated = new Set(validatedIds);
  const words = searchable(options.query).trim().split(/\s+/).filter(Boolean);
  const filtered = lessons.filter(lesson => {
    if (options.category !== 'all' && lesson.category !== options.category) return false;
    if (options.status === 'validated' && !validated.has(lesson.id)) return false;
    if (options.status === 'pending' && validated.has(lesson.id)) return false;
    const text = searchable([lesson.title, lesson.japanese, lesson.description, lesson.category].join(' '));
    return words.every(word => text.includes(word));
  });
  if (options.sort === 'title') filtered.sort((a, b) => titleOrder.compare(a.title, b.title));
  if (options.sort === 'review') {
    const ranks = new Map(reviewOrder.map((id, index) => [id, index]));
    filtered.sort((a, b) => (ranks.get(a.id) ?? lessons.length) - (ranks.get(b.id) ?? lessons.length));
  }
  const pageCount = Math.max(1, Math.ceil(filtered.length / LESSON_PAGE_SIZE));
  const page = Math.max(1, Math.min(pageCount, options.page));
  const start = (page - 1) * LESSON_PAGE_SIZE;
  return { items: filtered.slice(start, start + LESSON_PAGE_SIZE), total: filtered.length, page, pageCount, start };
}
