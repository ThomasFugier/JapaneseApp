import { openDB } from 'idb';
import { readConversation, type ConversationMessage } from './conversation';

const database = () => openDB('kotoba-conversation', 1, { upgrade(db) { db.createObjectStore('conversation'); } });

export async function loadConversation(): Promise<ConversationMessage[]> {
  const db = await database();
  try { return readConversation(await db.get('conversation', 'messages')); }
  finally { db.close(); }
}

export async function saveConversation(messages: ConversationMessage[]): Promise<void> {
  const db = await database();
  try { await db.put('conversation', readConversation(messages), 'messages'); }
  finally { db.close(); }
}
