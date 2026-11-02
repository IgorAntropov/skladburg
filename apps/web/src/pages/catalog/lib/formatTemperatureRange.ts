import type { TemperatureRange } from '@skladburg/contracts/catalog/v1/catalog';

const MINUS_SIGN = '\u2212';

const NO_BREAK_SPACE = '\u00a0';

const formatDegrees = (celsius: number): string => {
  if (celsius > 0) {
    return `+${String(celsius)}`;
  }

  return celsius < 0 ? `${MINUS_SIGN}${String(-celsius)}` : '0';
};

export const formatTemperatureRange = (range: TemperatureRange | undefined): string | undefined => {
  if (range === undefined) {
    return undefined;
  }

  const isSingleValue = range.minCelsius === range.maxCelsius;
  const degrees = isSingleValue
    ? formatDegrees(range.minCelsius)
    : `${formatDegrees(range.minCelsius)}…${formatDegrees(range.maxCelsius)}`;

  return `${degrees}${NO_BREAK_SPACE}°C`;
};
