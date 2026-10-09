const FIRST_LETTER_OR_DIGIT_PATTERN = /[\p{L}\p{N}]/u;
const WHITESPACE_PATTERN = /\s+/;
const MAX_INITIALS = 2;

const readWordInitial = (word: string): string | undefined => FIRST_LETTER_OR_DIGIT_PATTERN.exec(word)?.[0];

export const getInitials = (name: string): string => name
  .split(WHITESPACE_PATTERN)
  .flatMap(word => readWordInitial(word) ?? [])
  .slice(0, MAX_INITIALS)
  .join('')
  .toLocaleUpperCase('ru');
