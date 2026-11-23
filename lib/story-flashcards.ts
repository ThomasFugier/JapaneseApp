import type { Story, StoryWord } from './stories';

export type StoryFlashcardDraft = { word: StoryWord; example: string; story: Pick<Story, 'subtitle' | 'title' | 'level'> };

export function storyFlashcardValues(draft: StoryFlashcardDraft) {
  return {
    japanese: draft.word.text.trim(), reading: draft.word.reading.trim(), meaning: draft.word.meaning.trim(),
    example: draft.example, exampleTranslation: '',
    explanation: `Histoire : ${draft.story.subtitle} (${draft.story.title}) · ${draft.story.level}`,
    tags: ['Histoires', draft.story.level],
  };
}
