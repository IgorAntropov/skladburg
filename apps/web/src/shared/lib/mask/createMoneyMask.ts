import type { InputMaskValue } from './inputMaskTypes';

import { createScaledNumberMask } from './createScaledNumberMask';

const MONEY_FRACTION_DIGITS = 2;
const MONEY_SCALE = 100n;

export const createMoneyMask = (): InputMaskValue =>
  createScaledNumberMask({ fractionDigits: MONEY_FRACTION_DIGITS, scale: MONEY_SCALE });
