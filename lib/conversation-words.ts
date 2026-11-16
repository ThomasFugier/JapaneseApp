import { contextualReadings } from './contextual-readings';

export type ConversationWord = {
  text: string;
  lemma: string;
  reading: string;
  dictionaryReading: string;
  partOfSpeech: string;
  definitions: string[];
  language: 'fr' | 'en' | null;
  source: 'JMdict' | null;
};

export type ConversationCardDraft = { japanese: string; reading: string; meaning: string; example: string; explanation: string };

export function readConversationWords(value: unknown, text: string): ConversationWord[] | undefined {
  if (!Array.isArray(value) || value.length > 1500) return;
  const words: ConversationWord[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return;
    const word = item as ConversationWord;
    if (![word.text, word.lemma, word.reading, word.dictionaryReading, word.partOfSpeech].every(field => typeof field === 'string' && field.length <= 1000)
      || !Array.isArray(word.definitions) || word.definitions.length > 4 || word.definitions.some(definition => typeof definition !== 'string' || definition.length > 300)
      || !['fr', 'en', null].includes(word.language) || !['JMdict', null].includes(word.source)) return;
    words.push({ text: word.text, lemma: word.lemma, reading: word.reading, dictionaryReading: word.dictionaryReading, partOfSpeech: word.partOfSpeech, definitions: [...word.definitions], language: word.language, source: word.source });
  }
  return words.map(word => word.text).join('') === text ? contextualReadings(words) : undefined;
}

export function conversationCardDraft(word: ConversationWord, sentence: string): ConversationCardDraft {
  return { japanese: word.lemma || word.text, reading: word.dictionaryReading || word.reading, meaning: word.definitions.join(' ; '), example: sentence.slice(0, 3000).replace(/[\uD800-\uDBFF]$/, ''), explanation: word.source ? `JMdict · ${word.language === 'fr' ? 'français' : 'anglais'} · sens de dictionnaire à vérifier dans cet exemple.` : '' };
}
