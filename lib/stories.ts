export type StoryWord = { text: string; reading: string; meaning: string };
export type Story = {
  id: string;
  title: string;
  reading: string;
  subtitle: string;
  level: 'N5' | 'N4';
  theme: 'cat' | 'rain' | 'moon' | 'train' | 'letter' | 'sea';
  description: string;
  paragraphs: (StoryWord | string)[][];
};

export function storyText(story: Story): string {
  return story.paragraphs.map(parts => parts.map(part => typeof part === 'string' ? part : part.text).join('')).join('\n');
}

export type StoryProgress = { currentId: string | null; readIds: string[] };
export function sanitizeStoryProgress(value: unknown, stories: readonly Pick<Story, 'id'>[]): StoryProgress {
  const saved = value && typeof value === 'object' ? value as Partial<StoryProgress> : {};
  const ids = new Set(stories.map(story => story.id));
  return {
    currentId: typeof saved.currentId === 'string' && ids.has(saved.currentId) ? saved.currentId : null,
    readIds: Array.isArray(saved.readIds) ? [...new Set(saved.readIds.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [],
  };
}
