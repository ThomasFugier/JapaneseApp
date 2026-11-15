import assert from 'node:assert/strict';
import test from 'node:test';
import { conversationModelForDevice, isMobileConversationDevice, LIGHT_CONVERSATION_MODEL as light, QUALITY_CONVERSATION_MODEL as quality, markConversationRunning, wasConversationInterrupted } from '../lib/conversation-runtime';

test('phones and desktop-mode iPads use a separate lightweight default without migrating legacy quality', () => {
  for (const device of [
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux', maxTouchPoints: 5 },
  ]) assert.equal(isMobileConversationDevice(device), true);
  assert.equal(isMobileConversationDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(conversationModelForDevice(true, quality, null, false), light);
  assert.equal(conversationModelForDevice(true, quality, light, false), light);
  assert.equal(conversationModelForDevice(true, light, quality, false), quality);
  assert.equal(conversationModelForDevice(false, quality, light, false), quality);
  assert.equal(conversationModelForDevice(false, light, quality, false), light);
  assert.equal(conversationModelForDevice(true, quality, 'unknown', false), light);
});

test('an interrupted GPU run survives reload until cleared and recovers with the lightweight model', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  assert.equal(wasConversationInterrupted(storage), false);
  markConversationRunning(storage, true);
  assert.equal(wasConversationInterrupted(storage), true);
  assert.equal(conversationModelForDevice(true, quality, quality, wasConversationInterrupted(storage)), light);
  markConversationRunning(storage, false);
  assert.equal(wasConversationInterrupted(storage), false);
  assert.equal(conversationModelForDevice(false, quality, null, true), light);
});

test('unavailable session storage does not break the chat', () => {
  const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); }, removeItem: () => { throw Error('blocked'); } };
  assert.equal(wasConversationInterrupted(blocked), false);
  assert.doesNotThrow(() => markConversationRunning(blocked, true));
  assert.doesNotThrow(() => markConversationRunning(blocked, false));
});
