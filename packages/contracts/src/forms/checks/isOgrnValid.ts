const OGRN_PATTERN = /^(?:[0-9]{13}|[0-9]{15})$/;
const OGRN_LENGTH = 13;
const OGRN_DIVISOR = 11n;
const OGRNIP_DIVISOR = 13n;
const DECIMAL_BASE = 10n;

export const isOgrnValid = (value: string): boolean => {
  if (!OGRN_PATTERN.test(value)) {
    return false;
  }

  const divisor = value.length === OGRN_LENGTH ? OGRN_DIVISOR : OGRNIP_DIVISOR;
  const body = BigInt(value.slice(0, -1));

  return (body % divisor) % DECIMAL_BASE === BigInt(value.slice(-1));
};
