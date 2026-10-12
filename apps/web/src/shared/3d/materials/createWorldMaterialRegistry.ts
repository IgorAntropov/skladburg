import { MeshStandardMaterial } from 'three';

import type {
  WorldPaletteKeyValue,
  WorldPaletteValue,
} from '../palette/worldPaletteKeys';

import { applyRgbaColor } from '../world/applyRgbaColor';

export interface IWorldMaterialRegistry {
  applyPalette: (palette: WorldPaletteValue) => void;
  dispose: () => void;
  get: (key: WorldPaletteKeyValue) => MeshStandardMaterial;
}

export const createWorldMaterialRegistry = (initialPalette: WorldPaletteValue): IWorldMaterialRegistry => {
  const materials = new Map<WorldPaletteKeyValue, MeshStandardMaterial>();
  let palette = initialPalette;

  const get = (key: WorldPaletteKeyValue): MeshStandardMaterial => {
    const existing = materials.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const material = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 1,
    });
    applyRgbaColor(material.color, palette[key]);
    materials.set(key, material);

    return material;
  };

  const applyPalette = (nextPalette: WorldPaletteValue): void => {
    palette = nextPalette;
    materials.forEach((material, key) => {
      applyRgbaColor(material.color, nextPalette[key]);
    });
  };

  const dispose = (): void => {
    materials.forEach((material) => {
      material.dispose();
    });
  };

  return {
    applyPalette,
    dispose,
    get,
  };
};
