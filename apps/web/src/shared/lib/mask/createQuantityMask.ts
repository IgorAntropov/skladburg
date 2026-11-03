import type { InputMaskValue } from './inputMaskTypes';

import { createScaledNumberMask } from './createScaledNumberMask';

const POWER_OF_TEN_PATTERN = /^10*$/u;

export const createQuantityMask = (priceUnitBaseQuantity: bigint): InputMaskValue => {
  const baseText = priceUnitBaseQuantity.toString();
  const isPowerOfTen = POWER_OF_TEN_PATTERN.test(baseText);

  return createScaledNumberMask({
    fractionDigits: isPowerOfTen ? baseText.length - 1 : 0,
    scale: isPowerOfTen ? priceUnitBaseQuantity : 1n,
  });
};
