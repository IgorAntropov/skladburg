import type { RgbaColorValue } from './RgbaColorValue';

import { MAX_CHANNEL } from './maxChannel';

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUMBER_SOURCE = '\\d+(?:\\.\\d+)?|\\.\\d+';
const RGB_PATTERN = new RegExp(
  `^rgb\\(\\s*(${NUMBER_SOURCE})\\s+(${NUMBER_SOURCE})\\s+(${NUMBER_SOURCE})\\s*(?:/\\s*(${NUMBER_SOURCE})(%?)\\s*)?\\)$`,
  'i',
);
const SHORT_HEX_DIGIT_COUNT = 3;

const expandHexDigits = (digits: string): string => {
  if (digits.length !== SHORT_HEX_DIGIT_COUNT) {
    return digits;
  }

  return digits.split('').map(digit => digit + digit).join('');
};

const parseHexColor = (digits: string): RgbaColorValue => {
  const expanded = expandHexDigits(digits);
  const readChannel = (offset: number): number => {
    return expanded.length > offset
      ? Number.parseInt(expanded.slice(offset, offset + 2), 16)
      : MAX_CHANNEL;
  };

  return {
    alpha: readChannel(6) / MAX_CHANNEL,
    blue: readChannel(4),
    green: readChannel(2),
    red: readChannel(0),
  };
};

const parseRgbFunction = (match: RegExpExecArray): RgbaColorValue | undefined => {
  const [, redSource, greenSource, blueSource, alphaSource, percentMark] = match;
  const [red, green, blue] = [redSource, greenSource, blueSource].map(Number);
  const rawAlpha = alphaSource === undefined ? 1 : Number(alphaSource);
  const alpha = percentMark === '%' ? rawAlpha / 100 : rawAlpha;

  if (
    red === undefined
    || green === undefined
    || blue === undefined
    || [red, green, blue].some(channel => channel > MAX_CHANNEL)
    || alpha > 1
  ) {
    return undefined;
  }

  return { alpha, blue, green, red };
};

export const parseCssColor = (value: string): RgbaColorValue | undefined => {
  const trimmed = value.trim();
  const hexMatch = HEX_PATTERN.exec(trimmed);

  if (hexMatch?.[1] !== undefined) {
    return parseHexColor(hexMatch[1]);
  }

  const rgbMatch = RGB_PATTERN.exec(trimmed);

  return rgbMatch === null ? undefined : parseRgbFunction(rgbMatch);
};
