import type { InputMaskValue } from './inputMaskTypes';

import { createScaledNumberMask } from './createScaledNumberMask';

export const createWholeNumberMask = (): InputMaskValue =>
  createScaledNumberMask({ fractionDigits: 0, scale: 1n });
