import type { PriceUnit } from '@skladburg/contracts/catalog/v1/catalog';

import type { LocaleCode } from '@/shared/i18n';

const NO_BREAK_SPACE = '\u00a0';

const quantityFormats = new Map<LocaleCode, Intl.NumberFormat>();

const getQuantityFormat = (locale: LocaleCode): Intl.NumberFormat => {
  const cached = quantityFormats.get(locale);

  if (cached !== undefined) {
    return cached;
  }

  const created = new Intl.NumberFormat(locale);
  quantityFormats.set(locale, created);

  return created;
};

export const formatQuantity = (
  locale: LocaleCode,
  baseQuantity: bigint,
  priceUnit: PriceUnit,
  baseUnitLabel: string,
): string => {
  const format = getQuantityFormat(locale);
  const isMultipleOfPriceUnit = priceUnit.baseQuantity > 0n && baseQuantity % priceUnit.baseQuantity === 0n;

  if (isMultipleOfPriceUnit) {
    return `${format.format(baseQuantity / priceUnit.baseQuantity)}${NO_BREAK_SPACE}${priceUnit.name}`;
  }

  return `${format.format(baseQuantity)}${NO_BREAK_SPACE}${baseUnitLabel}`;
};
