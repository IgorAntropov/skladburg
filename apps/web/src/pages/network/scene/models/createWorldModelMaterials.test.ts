import type { MeshStandardMaterial } from 'three';

import { DataTexture } from 'three';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { buildWorldModelPalettePixels } from './buildWorldModelPalettePixels';
import { createWorldModelGeometry } from './createWorldModelGeometry';
import {
  createWorldModelMaterials,
  WORLD_MODEL_GROUPS,
} from './createWorldModelMaterials';
import {
  createTestPalette,
  createTestWorldModel,
} from './worldModelTestSupport';

const readTexture = (material: MeshStandardMaterial): DataTexture => {
  if (!(material.map instanceof DataTexture)) {
    throw new Error('The palette texture of the model material is not a data texture');
  }

  return material.map;
};

const readPixels = (material: MeshStandardMaterial): number[] => Array.from(readTexture(material).image.data ?? []);

describe('createWorldModelMaterials', () => {
  it('makes a flat-shaded vertex-colored material with a 10 by 1 palette texture per group', () => {
    const { materials } = createWorldModelMaterials(createTestPalette(0));

    for (const group of WORLD_MODEL_GROUPS) {
      const texture = readTexture(materials[group]);

      expect(materials[group].flatShading).toBe(true);
      expect(materials[group].vertexColors).toBe(true);
      expect(materials[group].metalness).toBe(0);
      expect(materials[group].roughness).toBe(1);
      expect(texture.image).toMatchObject({ height: 1, width: 10 });
      expect(texture.generateMipmaps).toBe(false);
      expect(texture.colorSpace).toBe('srgb');
    }
  });

  it('starts with the pixels of the first palette', () => {
    const palette = createTestPalette(0);
    const { materials } = createWorldModelMaterials(palette);

    for (const group of WORLD_MODEL_GROUPS) {
      expect(readPixels(materials[group])).toEqual([...buildWorldModelPalettePixels(group, palette)]);
    }
  });

  it('recolors the same textures when the palette changes and asks for an upload', () => {
    const registry = createWorldModelMaterials(createTestPalette(0));
    const nextPalette = createTestPalette(101);
    const textures = WORLD_MODEL_GROUPS.map(group => readTexture(registry.materials[group]));
    const versions = textures.map(texture => texture.version);

    registry.applyPalette(nextPalette);

    for (const [index, group] of WORLD_MODEL_GROUPS.entries()) {
      const texture = readTexture(registry.materials[group]);

      expect(texture).toBe(textures[index]);
      expect(texture.version).toBeGreaterThan(versions[index] ?? 0);
      expect(readPixels(registry.materials[group])).toEqual([...buildWorldModelPalettePixels(group, nextPalette)]);
    }
  });

  it('does not touch geometry when the palette changes', () => {
    const geometry = createWorldModelGeometry(createTestWorldModel());
    const colors = [...geometry.getAttribute('color').array];
    const registry = createWorldModelMaterials(createTestPalette(0));

    registry.applyPalette(createTestPalette(101));

    expect([...geometry.getAttribute('color').array]).toEqual(colors);
  });

  it('disposes materials and textures', () => {
    const registry = createWorldModelMaterials(createTestPalette(0));
    const disposers = WORLD_MODEL_GROUPS.flatMap(group => [
      vi.spyOn(registry.materials[group], 'dispose'),
      vi.spyOn(readTexture(registry.materials[group]), 'dispose'),
    ]);

    registry.dispose();

    expect(disposers).toHaveLength(6);

    for (const disposer of disposers) {
      expect(disposer).toHaveBeenCalledOnce();
    }
  });
});
