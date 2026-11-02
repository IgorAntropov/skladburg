const POWER_OF_TEN_PATTERN = /^10*$/;
const WHITESPACE_PATTERN = /\s+/g;
const DECIMAL_TEXT_PATTERN = /^(\d*)(?:[.,](\d*))?$/;

export const parseDecimalToMinor = (text: string, scale: bigint): bigint | undefined => {
  const scaleText = scale.toString();

  if (!POWER_OF_TEN_PATTERN.test(scaleText)) {
    return undefined;
  }

  const match = DECIMAL_TEXT_PATTERN.exec(text.replace(WHITESPACE_PATTERN, ''));

  if (match === null) {
    return undefined;
  }

  const [, whole = '', fraction = ''] = match;
  const fractionDigits = scaleText.length - 1;

  if ((whole === '' && fraction === '') || fraction.length > fractionDigits) {
    return undefined;
  }

  return BigInt(whole === '' ? '0' : whole) * scale + BigInt(fraction.padEnd(fractionDigits, '0') || '0');
};
