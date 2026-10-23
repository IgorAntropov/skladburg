import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useState,
} from 'react';

import { useWorldPalette } from '@/shared/3d';

import type { WorldModelMaterialsValue } from './createWorldModelMaterials';

import { createWorldModelMaterials } from './createWorldModelMaterials';

export const useWorldModelMaterials = (): WorldModelMaterialsValue => {
  const palette = useWorldPalette();
  const invalidate = useThree(state => state.invalidate);
  const [registry] = useState(() => createWorldModelMaterials(palette));

  useEffect(() => {
    registry.applyPalette(palette);
    invalidate();
  }, [invalidate, palette, registry]);

  useEffect(() => {
    return () => {
      registry.dispose();
    };
  }, [registry]);

  return registry.materials;
};
