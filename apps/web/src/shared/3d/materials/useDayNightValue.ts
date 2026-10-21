import type { DayNightUniformValue } from './createWorldGlowMaterialRegistry';

import { useWorldMaterialsContext } from './useWorldMaterialsContext';

export const useDayNightValue = (): Readonly<DayNightUniformValue> => {
  return useWorldMaterialsContext().glow.dayNight;
};
