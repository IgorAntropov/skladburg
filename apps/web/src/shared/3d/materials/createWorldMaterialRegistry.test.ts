import type { MeshStandardMaterial } from 'three';

import { SRGBColorSpace } from 'three';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { RgbaColorValue } from '@/shared/lib/color';

import type { WorldPaletteValue } from '../palette/worldPaletteKeys';

import { createWorldMaterialRegistry } from './createWorldMaterialRegistry';

const createUniformPalette = (color: RgbaColorValue): WorldPaletteValue => {
  return {
    background: color,
    board: color,
    boardEdge: color,
    groundDay: color,
    skyDay: color,
    sunDay: color,
    tile: color,
    tileSeam: color,
  };
};

const FIRST_COLOR: RgbaColorValue = {
  alpha: 1,
  blue: 30,
  green: 20,
  red: 10,
};

const SECOND_COLOR: RgbaColorValue = {
  alpha: 1,
  blue: 200,
  green: 150,
  red: 100,
};

const CHANNEL_MAX = 255;

const readChannels = (material: MeshStandardMaterial): number[] => {
  const target = {
    b: 0,
    g: 0,
    r: 0,
  };
  material.color.getRGB(target, SRGBColorSpace);

  return [target.r, target.g, target.b].map(channel => Math.round(channel * CHANNEL_MAX));
};

describe('createWorldMaterialRegistry', () => {
  it('returns one shared instance for a key', () => {
    const registry = createWorldMaterialRegistry(createUniformPalette(FIRST_COLOR));

    expect(registry.get('tile')).toBe(registry.get('tile'));
    expect(registry.get('tile')).not.toBe(registry.get('board'));
  });

  it('creates flat-shaded matte materials in the palette color', () => {
    const material = createWorldMaterialRegistry(createUniformPalette(FIRST_COLOR)).get('tile');

    expect(material.flatShading).toBe(true);
    expect(material.roughness).toBe(1);
    expect(material.metalness).toBe(0);
    expect(readChannels(material)).toEqual([10, 20, 30]);
  });

  it('recolors existing materials in place when the palette changes', () => {
    const registry = createWorldMaterialRegistry(createUniformPalette(FIRST_COLOR));
    const material = registry.get('tile');

    registry.applyPalette(createUniformPalette(SECOND_COLOR));

    expect(registry.get('tile')).toBe(material);
    expect(readChannels(material)).toEqual([100, 150, 200]);
  });

  it('creates materials requested after a palette change in the new colors', () => {
    const registry = createWorldMaterialRegistry(createUniformPalette(FIRST_COLOR));

    registry.applyPalette(createUniformPalette(SECOND_COLOR));

    expect(readChannels(registry.get('board'))).toEqual([100, 150, 200]);
  });

  it('disposes every created material', () => {
    const registry = createWorldMaterialRegistry(createUniformPalette(FIRST_COLOR));
    const tile = registry.get('tile');
    const board = registry.get('board');
    const tileDispose = vi.spyOn(tile, 'dispose');
    const boardDispose = vi.spyOn(board, 'dispose');

    registry.dispose();

    expect(tileDispose).toHaveBeenCalledTimes(1);
    expect(boardDispose).toHaveBeenCalledTimes(1);
  });
});
