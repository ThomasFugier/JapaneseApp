import { japaneseWords } from './furigana-client';
import { dictionaryKey, dictionaryShard, dictionaryWord, wordLookupKeys, type DictionaryShard } from './conversation-dictionary';
import { readConversationWords, type ConversationWord } from './conversation-words';

const shards = new Map<string, DictionaryShard>();
const fetching = new Map<string, Promise<DictionaryShard>>();
const running = new Map<string, Promise<ConversationWord[]>>();
let queue: Promise<unknown> = Promise.resolve();

function loadShard(id: string): Promise<DictionaryShard> {
  const cached = shards.get(id);
  if (cached) { shards.delete(id); shards.set(id, cached); return Promise.resolve(cached); }
  const existing = fetching.get(id);
  if (existing) return existing;
  const request = fetch(`/conversation-dictionary/v1/${id}.json`, { cache: 'force-cache' }).then(async response => {
    if (!response.ok) throw Error('Le dictionnaire est indisponible.');
    const result = await response.json() as DictionaryShard;
    shards.set(id, result);
    while (shards.size > 12) shards.delete(shards.keys().next().value!);
    return result;
  }).finally(() => fetching.delete(id));
  fetching.set(id, request);
  return request;
}

async function lookup(keys: string[], result: Map<string, DictionaryShard>) {
  const ids = [...new Set(keys.map(dictionaryShard))].filter(id => !result.has(id));
  for (let i = 0; i < ids.length; i += 4) {
    await Promise.all(ids.slice(i, i + 4).map(async id => { result.set(id, await loadShard(id)); }));
  }
}

// Only visible messages request annotations. Serialize jobs and bound the shard
// cache so opening a long history cannot flood a phone with dictionary work.
export function annotateConversationWords(text: string): Promise<ConversationWord[]> {
  const existing = running.get(text);
  if (existing) return existing;
  const request = queue.catch(() => {}).then(async () => {
    const tokens = await japaneseWords(text);
    const lexical = tokens.filter(token => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(token.text));
    const loaded = new Map<string, DictionaryShard>();
    await lookup(lexical.map(token => dictionaryKey(token.lemma || token.text)), loaded);
    const get = (key: string) => loaded.get(dictionaryShard(key))?.[key] ?? [];
    const missing = lexical.filter(token => !get(dictionaryKey(token.lemma || token.text)).length);
    await lookup(missing.flatMap(wordLookupKeys), loaded);
    const words = tokens.map(token => {
      const primary = get(dictionaryKey(token.lemma || token.text));
      return dictionaryWord(token, primary.length ? primary : wordLookupKeys(token).flatMap(get));
    });
    const valid = readConversationWords(words, text);
    if (!valid) throw Error('Le découpage du message est incomplet.');
    return valid;
  }).finally(() => running.delete(text));
  running.set(text, request);
  queue = request;
  return request;
}
