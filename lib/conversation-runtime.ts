export const LIGHT_CONVERSATION_MODEL = 'Qwen3-1.7B-q4f16_1-MLC';
export const QUALITY_CONVERSATION_MODEL = 'Qwen3-4B-q4f16_1-MLC';
export const CONVERSATION_RUN_KEY = 'kotoba-conversation-running-v1';
export const MOBILE_CONVERSATION_MODEL_KEY = 'kotoba-conversation-mobile-model-v1';

export function isMobileConversationDevice(device: { userAgent: string; platform: string; maxTouchPoints: number }) {
  return /Android|iPhone|iPad|iPod/i.test(device.userAgent) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
}

export function conversationModelForDevice(mobile: boolean, saved: string | null, mobileSaved: string | null, interrupted: boolean) {
  if (interrupted) return LIGHT_CONVERSATION_MODEL;
  const preferred = mobile ? mobileSaved : saved;
  return preferred === LIGHT_CONVERSATION_MODEL || preferred === QUALITY_CONVERSATION_MODEL
    ? preferred : mobile ? LIGHT_CONVERSATION_MODEL : QUALITY_CONVERSATION_MODEL;
}

export function wasConversationInterrupted(storage: Pick<Storage, 'getItem'>) {
  try { return storage.getItem(CONVERSATION_RUN_KEY) === 'running'; }
  catch { return false; }
}

export function markConversationRunning(storage: Pick<Storage, 'setItem' | 'removeItem'>, running: boolean) {
  try {
    if (running) storage.setItem(CONVERSATION_RUN_KEY, 'running');
    else storage.removeItem(CONVERSATION_RUN_KEY);
  } catch { /* A blocked session store must not prevent conversation. */ }
}
