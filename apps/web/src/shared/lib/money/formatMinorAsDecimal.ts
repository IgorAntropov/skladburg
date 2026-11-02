import { getMinorScale } from './getMinorScale';
import { MINUS_SIGN } from './moneyConstants';

const DECIMAL_SEPARATOR = ',';

export const formatMinorAsDecimal = (amountMinor: bigint, fractionDigits: number): string => {
  const isNegative = amountMinor < 0n;
  const absolute = isNegative ? -amountMinor : amountMinor;
  const sign = isNegative ? MINUS_SIGN : '';

  if (fractionDigits === 0) {
    return `${sign}${absolute.toString()}`;
  }

  const scale = getMinorScale(fractionDigits);
  const fraction = (absolute % scale).toString().padStart(fractionDigits, '0');

  return `${sign}${(absolute / scale).toString()}${DECIMAL_SEPARATOR}${fraction}`;
};
