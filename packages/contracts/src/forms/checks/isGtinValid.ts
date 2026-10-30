const GTIN_PATTERN = /^(?:[0-9]{8}|[0-9]{12,14})$/;
const ODD_POSITION_WEIGHT = 3;
const EVEN_POSITION_WEIGHT = 1;
const DECIMAL_BASE = 10;

export const isGtinValid = (value: string): boolean => {
  if (!GTIN_PATTERN.test(value)) {
    return false;
  }

  const body = value.slice(0, -1);
  const checkDigit = Number(value.slice(-1));
  let sum = 0;

  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    sum += digit * (index % 2 === 0 ? ODD_POSITION_WEIGHT : EVEN_POSITION_WEIGHT);
  }

  return (DECIMAL_BASE - (sum % DECIMAL_BASE)) % DECIMAL_BASE === checkDigit;
};
