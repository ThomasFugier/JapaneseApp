type Token = { text: string; reading?: string; dictionaryReading?: string };

/** Prefer the ordinary standalone reading; compounds such as 他方 stay intact. */
export function contextualReadings<T extends Token>(tokens: readonly T[]): T[] {
  return tokens.map((token, index) => {
    const next = tokens[index + 1]?.text;
    if (token.text !== '他' || !['の', 'に', 'にも'].includes(next ?? '') || !['た', 'タ'].includes(token.reading ?? '')) return token;
    return { ...token, reading: 'ほか', alignment: undefined,
      ...(token.dictionaryReading === 'た' || token.dictionaryReading === 'タ' ? { dictionaryReading: 'ほか' } : {}) };
  });
}
