/* Kuromoji and IPADIC notices are served alongside the dictionary. */
let tokenizer;
let alignments;
function loadAlignments() {
  if (!alignments) alignments = fetch('/furigana/alignments-v1.json.gz').then(async response => {
    if (!response.ok) throw new Error('Alignment dictionary unavailable');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const body = bytes[0] === 31 && bytes[1] === 139
      ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')))
      : new Response(bytes);
    const data = await body.json();
    return new Map(data.entries.map(([text, reading, parts]) => [text + '\0' + reading, parts.map(([text, reading]) => ({ text, reading }))]));
  }).catch(error => { alignments = undefined; throw error; });
  return alignments;
}
function readingKey(reading) {
  return (reading || '').normalize('NFKC').replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
}
function loadTokenizer() {
  if (!tokenizer) tokenizer = new Promise((resolve, reject) => {
    importScripts('/furigana/kuromoji-0.1.2/kuromoji.js');
    self.kuromoji.builder({ dicPath: '/furigana/kuromoji-0.1.2/dict/' }).build((error, value) => error ? reject(error) : resolve(value));
  });
  return tokenizer;
}
self.onmessage = async event => {
  const { id, text, reading } = event.data;
  if (!Number.isSafeInteger(id) || typeof text !== 'string' || text.length > 100000) return;
  try {
    const aligned = await loadAlignments();
    if (typeof reading === 'string' && reading) {
      self.postMessage({ id, tokens: [{ text, reading, alignment: aligned.get(text + '\0' + readingKey(reading)) }] });
      return;
    }
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
        tokens.push({ text: token.surface_form, reading: token.reading, alignment: aligned.get(token.surface_form + '\0' + readingKey(token.reading)) });
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
