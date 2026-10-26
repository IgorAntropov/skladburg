export interface MonogramPartsValue {
  index: string;
  letters: string;
}

const LONG_LEGAL_FORM_PATTERN = new RegExp(
  [
    'общество\\s+с\\s+ограниченной\\s+ответственностью',
    'публичное\\s+акционерное\\s+общество',
    'закрытое\\s+акционерное\\s+общество',
    'открытое\\s+акционерное\\s+общество',
    'акционерное\\s+общество',
    'индивидуальный\\s+предприниматель',
  ].join('|'),
  'giu',
);

const LEGAL_FORM_TOKENS: ReadonlySet<string> = new Set([
  'inc',
  'jsc',
  'llc',
  'ltd',
  'ooo',
  'ано',
  'ао',
  'гуп',
  'жск',
  'зао',
  'ип',
  'кфх',
  'муп',
  'нко',
  'оао',
  'одо',
  'ооо',
  'пао',
  'тоо',
  'унп',
  'фгуп',
]);

const CONNECTOR_TOKENS: ReadonlySet<string> = new Set(['в', 'для', 'и', 'на', 'от', 'по']);

const NON_WORD_PATTERN = /[^\p{L}\p{N}]+/gu;

const NUMERIC_PATTERN = /^\p{N}+$/u;

const LETTER_PATTERN = /\p{L}/u;

const MONOGRAM_LOCALE = 'ru';

const SINGLE_WORD_LETTERS_COUNT = 3;

const isNumericWord = (word: string): boolean => NUMERIC_PATTERN.test(word);

const readNameTokens = (name: string): string[] => name
  .replace(LONG_LEGAL_FORM_PATTERN, ' ')
  .split(NON_WORD_PATTERN)
  .filter(word => word.length > 0)
  .filter(word => !LEGAL_FORM_TOKENS.has(word.toLocaleLowerCase(MONOGRAM_LOCALE)));

const dropConnectors = (words: readonly string[]): string[] => {
  const meaningfulWords = words.filter(word => !CONNECTOR_TOKENS.has(word.toLocaleLowerCase(MONOGRAM_LOCALE)));
  return meaningfulWords.length > 0 ? meaningfulWords : [...words];
};

const readWordLetters = (word: string | undefined): string[] => Array.from(word ?? '')
  .filter(character => LETTER_PATTERN.test(character));

const buildSingleWordLetters = (letters: readonly string[]): string => {
  const [firstLetter = '', ...followingLetters] = letters.slice(0, SINGLE_WORD_LETTERS_COUNT);
  return firstLetter.toLocaleUpperCase(MONOGRAM_LOCALE) + followingLetters.join('').toLocaleLowerCase(MONOGRAM_LOCALE);
};

const buildLetters = (words: readonly string[]): string => {
  const [firstLetters = [], secondLetters] = words.map(readWordLetters);
  if (secondLetters === undefined) {
    return buildSingleWordLetters(firstLetters);
  }
  const [firstLetter = ''] = firstLetters;
  const [secondLetter = ''] = secondLetters;
  return (firstLetter + secondLetter).toLocaleUpperCase(MONOGRAM_LOCALE);
};

export const buildMonogramParts = (name: string): MonogramPartsValue => {
  const tokens = readNameTokens(name);
  const index = tokens.find(isNumericWord) ?? '';
  const words = dropConnectors(tokens.filter(token => !isNumericWord(token)));
  return { index, letters: buildLetters(words) };
};
