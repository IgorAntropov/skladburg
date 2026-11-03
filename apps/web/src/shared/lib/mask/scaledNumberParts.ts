export interface ScaledNumberPartsValue {
  fraction: string;
  hasSeparator: boolean;
  whole: string;
}

const MAX_DIGITS = 18;
const DECIMAL_SEPARATOR = ',';
const GROUP_SEPARATOR = ' ';
const SEPARATOR_CHARS: ReadonlySet<string> = new Set([',', '.']);
const GROUP_PATTERN = /\B(?=(?:\d{3})+(?!\d))/gu;
const LEADING_ZEROS_PATTERN = /^0+(?=\d)/u;

export const EMPTY_NUMBER_PARTS: ScaledNumberPartsValue = { fraction: '', hasSeparator: false, whole: '' };

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

export const parseTypedNumber = (text: string, fractionDigits: number): ScaledNumberPartsValue => {
  const maxWholeDigits = MAX_DIGITS - fractionDigits;
  let whole = '';
  let fraction = '';
  let hasSeparator = false;

  for (const char of text) {
    if (isDigit(char) && hasSeparator) {
      fraction = fraction.length < fractionDigits ? fraction + char : fraction;
    }
    else if (isDigit(char) && whole === '0') {
      whole = char;
    }
    else if (isDigit(char)) {
      whole = whole.length < maxWholeDigits ? whole + char : whole;
    }
    else if (fractionDigits > 0 && !hasSeparator && SEPARATOR_CHARS.has(char)) {
      hasSeparator = true;
    }
  }

  return { fraction, hasSeparator, whole: hasSeparator && whole === '' ? '0' : whole };
};

export const parseStoredNumber = (digits: string, fractionDigits: number): ScaledNumberPartsValue => {
  if (digits === '') {
    return EMPTY_NUMBER_PARTS;
  }

  const padded = digits.padStart(fractionDigits + 1, '0');
  const splitIndex = padded.length - fractionDigits;

  return {
    fraction: padded.slice(splitIndex),
    hasSeparator: fractionDigits > 0,
    whole: padded.slice(0, splitIndex).replace(LEADING_ZEROS_PATTERN, ''),
  };
};

export const completeNumberParts = (parts: ScaledNumberPartsValue, fractionDigits: number): ScaledNumberPartsValue =>
  parts.whole === ''
    ? EMPTY_NUMBER_PARTS
    : {
        fraction: parts.fraction.padEnd(fractionDigits, '0'),
        hasSeparator: fractionDigits > 0,
        whole: parts.whole,
      };

export const formatNumberParts = (parts: ScaledNumberPartsValue): string =>
  parts.whole.replace(GROUP_PATTERN, GROUP_SEPARATOR) + (parts.hasSeparator ? DECIMAL_SEPARATOR + parts.fraction : '');

export const countNumberSigns = (parts: ScaledNumberPartsValue): number =>
  parts.whole.length + parts.fraction.length + (parts.hasSeparator ? 1 : 0);

export const findCaretAfterSigns = (text: string, signCount: number): number => {
  let seenCount = 0;

  for (let index = 0; index < text.length && signCount > 0; index += 1) {
    seenCount += text[index] === GROUP_SEPARATOR ? 0 : 1;

    if (seenCount === signCount) {
      return index + 1;
    }
  }

  return signCount > 0 ? text.length : 0;
};
