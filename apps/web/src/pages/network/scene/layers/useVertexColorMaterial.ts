import {
  useEffect,
  useMemo,
} from 'react';
import { MeshStandardMaterial } from 'three';

import type { WorldPaletteKeyValue } from '@/shared/3d';

import { useWorldMaterial } from '@/shared/3d';

export const useVertexColorMaterial = (key: WorldPaletteKeyValue): MeshStandardMaterial => {
  const source = useWorldMaterial(key);
  const material = useMemo((): MeshStandardMaterial => {
    const created = new MeshStandardMaterial({ flatShading: true, metalness: 0, roughness: 1, vertexColors: true });

    created.color = source.color;

    return created;
  }, [source]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return material;
};
