import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildWorldModelPalettePixels } from './buildWorldModelPalettePixels';
import { WORLD_MODEL_GROUPS } from './createWorldModelMaterials';
import { WORLD_MODEL_ROLES } from './format/worldModelFormat';
import { WORLD_MODEL_ROLE_KEYS } from './worldModelRoleKeys';
import { createTestPalette } from './worldModelTestSupport';

describe('buildWorldModelPalettePixels', () => {
  const palette = createTestPalette(0);

  it('writes the bytes of the token of the role key for every role of every group', () => {
    for (const group of WORLD_MODEL_GROUPS) {
      const pixels = buildWorldModelPalettePixels(group, palette);

      for (const [index, role] of WORLD_MODEL_ROLES.entries()) {
        const color = palette[WORLD_MODEL_ROLE_KEYS[group][role]];

        expect([...pixels.slice(index * 4, index * 4 + 4)]).toEqual([color.red, color.green, color.blue, 255]);
      }
    }
  });

  it('takes the wall of the warehouse from its own key and not from the house one', () => {
    const warehouse = buildWorldModelPalettePixels('warehouse', palette);
    const house = buildWorldModelPalettePixels('house', palette);

    expect([...warehouse.slice(0, 3)]).toEqual([
      palette.warehouseWall.red,
      palette.warehouseWall.green,
      palette.warehouseWall.blue,
    ]);
    expect([...house.slice(0, 3)]).not.toEqual([...warehouse.slice(0, 3)]);
  });

  it('gives different pixels for two different palettes', () => {
    const light = buildWorldModelPalettePixels('warehouse', createTestPalette(0));
    const dark = buildWorldModelPalettePixels('warehouse', createTestPalette(101));

    expect([...light]).not.toEqual([...dark]);
  });

  it('keeps every channel in the byte range', () => {
    const pixels = buildWorldModelPalettePixels('office', createTestPalette(255));

    expect([...pixels].every(value => Number.isInteger(value) && value >= 0 && value <= 255)).toBe(true);
  });
});
