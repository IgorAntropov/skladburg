import type { MeshStandardMaterial } from 'three';

import type { WorldPaletteKeyValue } from '../palette/worldPaletteKeys';

import { useWorldMaterialsContext } from './useWorldMaterialsContext';

export const useWorldMaterial = (key: WorldPaletteKeyValue): MeshStandardMaterial => {
  return useWorldMaterialsContext().registry.get(key);
};
