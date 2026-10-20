const PORTABLE_SIMPLE_ESCAPES = 'dDwWnrtfv';
const PORTABLE_BOUNDARY_ESCAPES = 'bB';
const HEX_ESCAPE_PATTERN = /^x[0-9a-fA-F]{2}/;
const UNICODE_PROPERTY_ESCAPE_PATTERN = /^[pP]\{[A-Za-z_]+(=[A-Za-z_]+)?\}/;
const ASCII_LETTER_PATTERN = /^[A-Za-z]$/;
const ASCII_DIGIT_PATTERN = /^[0-9]$/;

const isCompilable = (source: string): boolean => {
  try {
    new RegExp(source, 'u');

    return true;
  }
  catch {
    return false;
  }
};

const getPortableEscapeLength = (source: string, index: number, isInClass: boolean): number | undefined => {
  const next = source[index + 1];

  if (next === undefined || ASCII_DIGIT_PATTERN.test(next)) {
    return undefined;
  }

  if (!ASCII_LETTER_PATTERN.test(next)) {
    return 2;
  }

  if (PORTABLE_SIMPLE_ESCAPES.includes(next)) {
    return 2;
  }

  if (PORTABLE_BOUNDARY_ESCAPES.includes(next)) {
    return isInClass ? undefined : 2;
  }

  const rest = source.slice(index + 1);

  if (next === 'x') {
    return HEX_ESCAPE_PATTERN.test(rest) ? 4 : undefined;
  }

  const propertyMatch = UNICODE_PROPERTY_ESCAPE_PATTERN.exec(rest);

  return propertyMatch === null ? undefined : propertyMatch[0].length + 1;
};

const hasNonPortableConstruct = (source: string): boolean => {
  let isInClass = false;
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === '\\') {
      const escapeLength = getPortableEscapeLength(source, index, isInClass);

      if (escapeLength === undefined) {
        return true;
      }

      index += escapeLength;
      continue;
    }

    if (isInClass) {
      if (char === '[' && source[index + 1] === ':') {
        return true;
      }

      if (char === ']') {
        isInClass = false;
      }

      index += 1;
      continue;
    }

    if (char === '.') {
      return true;
    }

    if (char === '(' && source[index + 1] === '?' && source[index + 2] !== ':') {
      return true;
    }

    if (char === '[') {
      isInClass = true;
      index += source[index + 1] === '^' ? 2 : 1;

      if (source[index] === ']') {
        return true;
      }

      continue;
    }

    index += 1;
  }

  return false;
};

export const isPortableRegexPattern = (source: string): boolean =>
  isCompilable(source) && !hasNonPortableConstruct(source);
