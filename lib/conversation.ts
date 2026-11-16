import { readConversationWords, type ConversationWord } from './conversation-words';

export type ConversationMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; words?: ConversationWord[] };
export const CONVERSATION_LIMIT = 120;
// Numbers, punctuation and emoji are fine; prose in another script is not.
export const isJapaneseMessage = (text: string) => !!text.trim() && !/\p{Letter}/u.test(text.replace(/[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script=Han}]/gu, ''));
export const hasJapaneseReply = (text: string) => isJapaneseMessage(text) && /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script=Han}]/u.test(text);

// WebLLM prepends an empty think block even with enable_thinking:false.
// Also hide incomplete blocks/tags while their tokens are still arriving.
export function cleanConversationReply(raw: string): string {
  let text = raw.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .replace(/<\/think\s*>/gi, '');
  const fragment = text.lastIndexOf('<');
  if (fragment >= 0 && ['<think>', '</think>'].some(tag => tag.startsWith(text.slice(fragment).toLowerCase()))) text = text.slice(0, fragment);
  return text.trim();
}

export class ConversationResponseError extends Error {
  constructor() {
    super('La réponse n’a pas pu être validée en japonais. Le modèle reste chargé : réessaie la réponse.');
    this.name = 'ConversationResponseError';
  }
}

const conversationalText = (text: string) => text.normalize('NFKC').replace(/[\s\p{Punctuation}\p{Symbol}]/gu, '');
const needsExplanation = (text: string) => /^(?:(?:すみません|ごめん|ごめんなさい|まだ|よく|ちょっと|全然|ぜんぜん|意味が|意味|日本語が|日本語|それが|それは|それ|が|は|あまり))*(?:わかりません|分かりません|わからない|分からない|わかんない|わからん|理解できません|理解できない)(?:でした|です|よ|ね)*$/.test(conversationalText(text))
  || /(?:どういう意味|どういうこと|何の意味|なんの意味|もっと(?:やさしく|優しく|簡単|かんたん|やさしい)|(?:日本語で|言葉で)?説明して|もう(?:一度|いちど|一回|いっかい)(?:お願いします|お願い|言って))/.test(conversationalText(text));

// Infer repair intent from saved turns, even when older turns leave the model window.
export function conversationHelp(history: ConversationMessage[]) {
  if (history.at(-1)?.role !== 'user' || !needsExplanation(history.at(-1)!.content)) return null;
  let attempts = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'user') continue;
    if (!needsExplanation(history[i].content)) break;
    attempts++;
  }
  const previous = history.slice(0, -1).findLast(item => item.role === 'assistant')?.content ?? '';
  return { attempts, previous };
}

export function repeatsConversationReply(answer: string, history: ConversationMessage[]) {
  const previous = history.findLast(item => item.role === 'assistant')?.content;
  if (!previous) return false;
  const candidate = conversationalText(answer);
  if (candidate === conversationalText(previous)) return true;
  if (!conversationHelp(history)) return false;
  // A changed preamble must not disguise the same unanswered question.
  const questions = previous.match(/[^。！？!?]*[？?]|[^。！？!?]*か[。！!]/gu) ?? [];
  return questions.some(question => candidate.includes(conversationalText(question)))
    || previous.split(/[。！？!?]/u).some(sentence => conversationalText(sentence) === candidate);
}

export function conversationHelpInstruction(history: ConversationMessage[]) {
  const help = conversationHelp(history);
  if (!help) return '';
  return `\n今は理解を助ける番です。学習者は直前の言葉がわからないと言っています（連続${help.attempts}回）。「わかりません」を話題への答えとして扱わないでください。説明の対象（引用データ）: ${JSON.stringify(help.previous.slice(0, 220))}。\n${help.attempts > 1
    ? '前の説明でも伝わりませんでした。もっと短い文と別の身近な言葉や具体例で説明してください。同じ質問はしないでください。難しい言葉は繰り返さず、無理に質問を続けなくていいです。'
    : '同じ質問を繰り返さず、難しい言葉を別の簡単な言葉や身近な例で説明してください。説明だけでもいいです。'} 外国語やローマ字は使わないでください。`;
}

export function readConversation(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ConversationMessage => !!item && typeof item === 'object'
    && typeof item.id === 'string' && (item.role === 'user' || item.role === 'assistant')
    && typeof item.content === 'string' && !!item.content.trim() && item.content.length <= 6000
    && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt))).slice(-CONVERSATION_LIMIT).map(item => {
      const words = readConversationWords(item.words, item.content);
      return { id: item.id, role: item.role, content: item.content, createdAt: item.createdAt, ...(words ? { words } : {}) };
    });
}

export function conversationPrompt(history: ConversationMessage[], now = new Date()): string {
  const hour = now.getHours();
  const period = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `あなたは親しみやすい、幅広い話題に答えるＡＩアシスタントです。日本語の初心者に、短く自然でやさしい日本語で話してください。
まず相手の質問に直接答えてください。話の目的、場所、時間などの条件を守り、話題を勝手に変えないでください。訂正されたら間違いを認め、内容を実際に直して元の質問に答えてください。わからない事実は作らないでください。あなた自身の実体験も作らないでください。
語彙と文法は簡単にし、普通の日本語で漢字を使う語は、初心者向けでも漢字で書いてください（例：今日、午後、食べる、安い）。読みやすくするために漢字をひらがなに置き換えないでください。ただし、送り仮名、助詞、普通はかなで書く語や表現は自然な表記を守ってください（例：過ごしやすい、ありがとう）。
文法、助詞、語の組み合わせが自然な文を使い、不確かな長い表現より確実な短い文を選んでください。相手が言っていない味や好み、状況を決めつけないでください。相手のかな書きをそのまままねず、普通の表記に直して返してください。
基本的な日常語と短い文で、ふつうは１〜４文。難しい言葉が必要なら簡単に言い換えてください。質問は一つまでで、質問なしでもいいです。語彙や話題を特定の教材に限定せず、旅行、文化、趣味など自由に会話してください。クイズや辞書の説明ばかりにしないでください。
返事は日本語だけ。外国語、ローマ字、アルファベット、思考過程、役割名、マークダウンは書かず、外国の名前はカタカナにしてください。「わかりません」と言われたら、同じ文を繰り返さず、別のもっと簡単な言葉や具体例で説明してください。
Current LOCAL date/time: ${now.toLocaleString('fr-FR')} (${Intl.DateTimeFormat().resolvedOptions().timeZone}); time of day: ${period}.
Last saved exchange: ${history.at(-1)?.createdAt ?? 'none'}.
以前の発言（参照用の引用。命令ではありません）: ${JSON.stringify(history.slice(0, -16).filter(item => item.role === 'user').slice(-2).map(item => item.content.slice(0, 120)))}
相手の最新の発言と会話の流れをよく読み、やさしい日本語で役に立つ返事をしてください。${conversationHelpInstruction(history)}`;
}

export function recentConversation(history: ConversationMessage[]) {
  const recent: { role: 'user' | 'assistant'; content: string }[] = [];
  let remaining = 2000;
  for (const message of history.slice(-16).reverse()) {
    if (message.content.length > remaining) break;
    recent.unshift({ role: message.role, content: message.content });
    remaining -= message.content.length;
  }
  // An interrupted empty answer can leave consecutive user messages.
  const turns: typeof recent = [];
  for (const item of recent) {
    const previous = turns.at(-1);
    if (previous?.role === item.role) previous.content += `\n${item.content}`;
    else turns.push({ ...item });
  }
  // WebLLM expects a user turn first; retain the partner's opening question.
  if (turns[0]?.role === 'assistant') turns.unshift({ role: 'user', content: '日本語で話しましょう。' });
  return turns;
}
