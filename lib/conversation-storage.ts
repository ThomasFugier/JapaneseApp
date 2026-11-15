import { openDB } from 'idb';
import { readConversation, type ConversationMessage } from './conversation';

const database = () => openDB('kotoba-conversation', 1, { upgrade(db) { db.createObjectStore('conversation'); } });

export async function loadConversation(): Promise<ConversationMessage[]> {
  const db = await database();
  try { return readConversation(await db.get('conversation', 'messages')); }
  finally { db.close(); }
}

let writing = Promise.resolve();
export function saveConversation(messages: ConversationMessage[]): Promise<void> {
  const snapshot = readConversation(messages);
  // An annotation can finish while another reply is being saved. Preserve call
  // order so an older IndexedDB connection cannot overwrite the newer history.
  const next = writing.catch(() => {}).then(async () => {
    const db = await database();
    try { await db.put('conversation', snapshot, 'messages'); }
    finally { db.close(); }
  });
  writing = next;
  return next;
}
