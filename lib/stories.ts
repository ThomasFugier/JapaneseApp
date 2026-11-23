export type StoryWord = { text: string; reading: string; meaning: string };
export const storyCategoryLabels = {
  jeunesse: 'Jeunesse',
  'tranche-de-vie': 'Tranche de vie',
  aventure: 'Aventure',
  'science-fiction': 'Science-fiction',
  fantastique: 'Fantastique',
  mystere: 'Mystère',
  humour: 'Humour',
  nouvelle: 'Nouvelle',
  roman: 'Roman',
  manga: 'Manga',
} as const;
export type StoryCategory = keyof typeof storyCategoryLabels;
export const storyCategoryIds = Object.keys(storyCategoryLabels) as [StoryCategory, ...StoryCategory[]];

export type Story = {
  id: string;
  title: string;
  reading: string;
  titleWords?: StoryWord[];
  subtitle: string;
  level: 'N5' | 'N4';
  categories?: StoryCategory[];
  theme: 'cat' | 'rain' | 'moon' | 'train' | 'letter' | 'sea';
  description: string;
  paragraphs: (StoryWord | string)[][];
};

export function storyCategoryText(story: Pick<Story, 'categories'>): string {
  return (story.categories ?? []).map(category => storyCategoryLabels[category]).join(' · ');
}

export function storyTitleWords(story: Story): readonly StoryWord[] {
  return story.titleWords ?? [{ text: story.title, reading: story.reading, meaning: story.subtitle }];
}

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
