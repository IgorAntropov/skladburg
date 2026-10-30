const INN_PATTERN = /^(?:[0-9]{10}|[0-9]{12})$/;
const LEGAL_ENTITY_LENGTH = 10;
const LEGAL_ENTITY_WEIGHTS: readonly number[] = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INDIVIDUAL_FIRST_WEIGHTS: readonly number[] = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const INDIVIDUAL_SECOND_WEIGHTS: readonly number[] = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const MODULUS = 11;
const DECIMAL_BASE = 10;

const computeCheckDigit = (digits: readonly number[], weights: readonly number[]): number =>
  (digits.reduce((sum, digit, position) => sum + digit * (weights[position] ?? 0), 0) % MODULUS) % DECIMAL_BASE;

export const isInnValid = (value: string): boolean => {
  if (!INN_PATTERN.test(value)) {
    return false;
  }

  const digits = Array.from(value, Number);

  if (digits.length === LEGAL_ENTITY_LENGTH) {
    return computeCheckDigit(digits.slice(0, -1), LEGAL_ENTITY_WEIGHTS) === digits.at(-1);
  }

  return computeCheckDigit(digits.slice(0, -2), INDIVIDUAL_FIRST_WEIGHTS) === digits.at(-2)
    && computeCheckDigit(digits.slice(0, -1), INDIVIDUAL_SECOND_WEIGHTS) === digits.at(-1);
};
