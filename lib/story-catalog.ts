// Server/build only. Pass the parsed catalog to the client as serializable data.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseStoryDocument } from './story-schema';
import { storyText, type Story } from './stories';

export function parseStoryCatalog(files: readonly { name: string; content: string }[]): readonly Story[] {
  const ids = new Set<string>();
  return [...files].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(file => {
    try {
      const story = parseStoryDocument(JSON.parse(file.content));
      if (ids.has(story.id)) throw new Error(`Duplicate story ID: ${story.id}`);
      ids.add(story.id);
      const length = storyText(story).replace(/\n/g, '').length;
      if (length < 80 || length > 250) throw new Error(`Expected 80–250 characters, received ${length}.`);
      return story;
    } catch (cause) {
      throw new Error(`Invalid story ${file.name}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    }
  });
}

export function loadStories(): readonly Story[] {
  // Keep these paths explicit so Next only traces story assets for deployment.
  return parseStoryCatalog(readdirSync(join(process.cwd(), 'content', 'stories'))
    .filter(name => name.endsWith('.json'))
    .map(name => ({ name, content: readFileSync(join(process.cwd(), 'content', 'stories', name), 'utf8') })));
}

export const stories = loadStories();
