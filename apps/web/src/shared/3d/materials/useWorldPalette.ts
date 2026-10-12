import type { WorldPaletteValue } from '../palette/worldPaletteKeys';

import { useWorldMaterialsContext } from './useWorldMaterialsContext';

export const useWorldPalette = (): WorldPaletteValue => {
  return useWorldMaterialsContext().palette;
};
