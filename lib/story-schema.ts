import { z } from 'zod';
import { storyCategoryIds, type Story, type StoryWord } from './stories';

const nonEmpty = z.string().trim().min(1);
const reading = z.string().regex(/^[ぁ-ゖー]+$/, 'Use hiragana for readings.');
const wordSchema: z.ZodType<StoryWord> = z.strictObject({ text: nonEmpty, reading, meaning: nonEmpty });

// Keep generated stories self-contained: no shared dictionary, external IDs or
// inferred word boundaries. A string token is reserved for punctuation only.
export const storyDocumentSchema = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal(1),
  language: z.literal('ja'),
  definitionLanguage: z.literal('fr'),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: nonEmpty,
  reading,
  titleWords: z.array(wordSchema).min(1).optional(),
  subtitle: nonEmpty,
  level: z.enum(['N5', 'N4']),
  categories: z.array(z.enum(storyCategoryIds)).min(1).max(4).refine(categories => new Set(categories).size === categories.length, 'Categories must be unique.').optional(),
  theme: z.enum(['cat', 'rain', 'moon', 'train', 'letter', 'sea']),
  description: nonEmpty,
  paragraphs: z.array(z.array(z.union([wordSchema, z.string().regex(/^[、。「」！？]+$/)])).min(1)).min(1),
});

export function parseStoryDocument(value: unknown): Story {
  const { $schema, schemaVersion, language, definitionLanguage, ...story } = storyDocumentSchema.parse(value);
  if (story.titleWords) {
    if (story.titleWords.map(word => word.text).join('') !== story.title) throw new Error('Title words must reconstruct the title.');
    if (story.titleWords.map(word => word.reading).join('') !== story.reading) throw new Error('Title word readings must reconstruct the title reading.');
  }
  return story;
}
