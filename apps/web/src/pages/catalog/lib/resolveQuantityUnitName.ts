import type { PriceUnit } from '@skladburg/contracts/catalog/v1/catalog';

const POWER_OF_TEN_PATTERN = /^10*$/u;

export const resolveQuantityUnitName = (priceUnit: PriceUnit | undefined, baseUnitLabel: string): string => {
  if (priceUnit === undefined || !POWER_OF_TEN_PATTERN.test(priceUnit.baseQuantity.toString())) {
    return baseUnitLabel;
  }

  return priceUnit.name;
};
