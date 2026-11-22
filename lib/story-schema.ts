import { z } from 'zod';
import type { Story, StoryWord } from './stories';

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
  subtitle: nonEmpty,
  level: z.enum(['N5', 'N4']),
  theme: z.enum(['cat', 'rain', 'moon', 'train', 'letter', 'sea']),
  description: nonEmpty,
  paragraphs: z.array(z.array(z.union([wordSchema, z.string().regex(/^[、。「」！？]+$/)])).min(1)).min(1),
});

export function parseStoryDocument(value: unknown): Story {
  const { $schema, schemaVersion, language, definitionLanguage, ...story } = storyDocumentSchema.parse(value);
  return story;
}
