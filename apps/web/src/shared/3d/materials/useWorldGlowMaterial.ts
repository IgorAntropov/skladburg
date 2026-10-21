import type { MeshBasicMaterial } from 'three';

import type { WorldGlowMaterialSpecValue } from './createWorldGlowMaterialRegistry';

import { useWorldMaterialsContext } from './useWorldMaterialsContext';

export const useWorldGlowMaterial = (spec: WorldGlowMaterialSpecValue): MeshBasicMaterial => {
  return useWorldMaterialsContext().glow.get(spec);
};
