import {
  ClampToEdgeWrapping,
  DataTexture,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';

import type { WorldPaletteValue } from '@/shared/3d';

import type { WorldModelGroupValue } from './worldModelCatalog';

import { buildWorldModelPalettePixels } from './buildWorldModelPalettePixels';
import { WORLD_MODEL_ROLES } from './format/worldModelFormat';

export interface IWorldModelMaterials {
  applyPalette: (palette: WorldPaletteValue) => void;
  dispose: () => void;
  materials: WorldModelMaterialsValue;
}

export type WorldModelMaterialsValue = Readonly<Record<WorldModelGroupValue, MeshStandardMaterial>>;

export const WORLD_MODEL_GROUPS: readonly WorldModelGroupValue[] = ['house', 'office', 'warehouse'];

interface GroupMaterialValue {
  material: MeshStandardMaterial;
  pixels: Uint8Array;
  texture: DataTexture;
}

const createGroupMaterial = (group: WorldModelGroupValue, palette: WorldPaletteValue): GroupMaterialValue => {
  const pixels = buildWorldModelPalettePixels(group, palette);
  const texture = new DataTexture(
    pixels,
    WORLD_MODEL_ROLES.length,
    1,
    RGBAFormat,
    UnsignedByteType,
  );

  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  const material = new MeshStandardMaterial({
    flatShading: true,
    map: texture,
    metalness: 0,
    roughness: 1,
    vertexColors: true,
  });

  return { material, pixels, texture };
};

export const createWorldModelMaterials = (initialPalette: WorldPaletteValue): IWorldModelMaterials => {
  const groupMaterials = {
    house: createGroupMaterial('house', initialPalette),
    office: createGroupMaterial('office', initialPalette),
    warehouse: createGroupMaterial('warehouse', initialPalette),
  };

  const applyPalette = (palette: WorldPaletteValue): void => {
    for (const group of WORLD_MODEL_GROUPS) {
      const { pixels, texture } = groupMaterials[group];

      pixels.set(buildWorldModelPalettePixels(group, palette));
      texture.needsUpdate = true;
    }
  };

  const dispose = (): void => {
    for (const group of WORLD_MODEL_GROUPS) {
      groupMaterials[group].material.dispose();
      groupMaterials[group].texture.dispose();
    }
  };

  return {
    applyPalette,
    dispose,
    materials: {
      house: groupMaterials.house.material,
      office: groupMaterials.office.material,
      warehouse: groupMaterials.warehouse.material,
    },
  };
};
