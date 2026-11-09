/* Kuromoji and IPADIC notices are served alongside the dictionary. */
let tokenizer;
function loadTokenizer() {
  if (!tokenizer) tokenizer = new Promise((resolve, reject) => {
    importScripts('/furigana/kuromoji-0.1.2/kuromoji.js');
    self.kuromoji.builder({ dicPath: '/furigana/kuromoji-0.1.2/dict/' }).build((error, value) => error ? reject(error) : resolve(value));
  });
  return tokenizer;
}
self.onmessage = async event => {
  const { id, text } = event.data;
  if (!Number.isSafeInteger(id) || typeof text !== 'string' || text.length > 100000) return;
  try {
    const dictionary = await loadTokenizer();
    const tokens = [];
    // Keep very long drafts bounded; each block preserves original offsets.
    let offset = 0;
    while (offset < text.length) {
      let end = Math.min(offset + 4000, text.length);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('。', end));
        if (boundary > offset + 2000) end = boundary + 1;
        if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      }
      const block = text.slice(offset, end);
      let cursor = 0;
      for (const token of dictionary.tokenize(block)) {
        const start = block.indexOf(token.surface_form, cursor);
        if (start < cursor) continue;
        if (start > cursor) tokens.push({ text: block.slice(cursor, start) });
        tokens.push({ text: token.surface_form, reading: token.reading });
        cursor = start + token.surface_form.length;
      }
      if (cursor < block.length) tokens.push({ text: block.slice(cursor) });
      offset = end;
    }
    self.postMessage({ id, tokens });
  } catch {
    tokenizer = undefined;
    self.postMessage({ id, error: 'The Japanese dictionary could not be loaded. Try again when online.' });
  }
};
