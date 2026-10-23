import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PngImageValue } from './decodePng.ts';

import {
  decodeWorldModelShade,
  WORLD_MODEL_ROLES,
  WORLD_MODEL_SHADE_RANGE,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import {
  COLORMAP_COLUMNS,
  COLORMAP_ROWS,
  sampleCell,
  toCellFraction,
  toCellId,
} from './colormapGrid.ts';
import {
  classifyColor,
  ROLE_ANCHORS,
} from './colorRoles.ts';
import { createVertexStyleResolver } from './createVertexStyleResolver.ts';

type ColorFnValue = (cellId: number, fraction: number) => [number, number, number];

const SIZE = 64;

const createColormap = (colorOf: ColorFnValue): PngImageValue => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const column = Math.floor((x / SIZE) * COLORMAP_COLUMNS);
      const row = Math.floor((y / SIZE) * COLORMAP_ROWS);
      const fraction = (y / SIZE) * COLORMAP_ROWS - row;
      const [red, green, blue] = colorOf(row * COLORMAP_COLUMNS + column, fraction);
      const offset = (y * SIZE + x) * 4;

      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = 255;
    }
  }

  return { data, height: SIZE, width: SIZE };
};

const toUv = (cellId: number, fraction: number): [number, number] => [
  ((cellId % COLORMAP_COLUMNS) + 0.5) / COLORMAP_COLUMNS,
  (Math.floor(cellId / COLORMAP_COLUMNS) + fraction) / COLORMAP_ROWS,
];

describe('colormap grid', () => {
  it('maps uv to a cell with the origin at the top left', () => {
    expect(toCellId(0.01, 0.01)).toBe(0);
    expect(toCellId(0.99, 0.01)).toBe(COLORMAP_COLUMNS - 1);
    expect(toCellId(0.01, 0.99)).toBe(COLORMAP_COLUMNS * (COLORMAP_ROWS - 1));
    expect(toCellId(0.5, 0.3)).toBe(COLORMAP_COLUMNS + 8);
  });

  it('clamps uv outside the texture to the edge cells', () => {
    expect(toCellId(-1, -1)).toBe(0);
    expect(toCellId(2, 2)).toBe(COLORMAP_COLUMNS * COLORMAP_ROWS - 1);
  });

  it('keeps the position inside a cell as a fraction', () => {
    expect(toCellFraction(0.125)).toBeCloseTo(0.5, 10);
    expect(toCellFraction(0.25)).toBeCloseTo(0, 10);
    expect(toCellFraction(1)).toBe(0);
  });

  it('samples the column centre at the requested height of the cell', () => {
    const colormap = createColormap((cellId, fraction) => [cellId, Math.floor(fraction * 100), 7]);

    expect(sampleCell(colormap, 5, 0.5)).toEqual({ blue: 7, green: 50, red: 5 });
    expect(sampleCell(colormap, 20, 0.25)).toEqual({ blue: 7, green: 25, red: 20 });
  });
});

describe('classifyColor', () => {
  it.each(ROLE_ANCHORS)('maps the anchor of $role to itself', ({ color, role }) => {
    expect(classifyColor(color)).toBe(role);
  });

  it('picks the nearest anchor for a colour near the anchor', () => {
    expect(classifyColor({ blue: 120, green: 160, red: 70 })).toBe('green');
    expect(classifyColor({ blue: 70, green: 80, red: 220 })).toBe('red');
    expect(classifyColor({ blue: 90, green: 70, red: 60 })).toBe('dark');
  });

  it('uses only roles from the format list', () => {
    expect(ROLE_ANCHORS.every(({ role }) => WORLD_MODEL_ROLES.includes(role))).toBe(true);
  });
});

describe('createVertexStyleResolver', () => {
  const [minShade, maxShade] = WORLD_MODEL_SHADE_RANGE;

  it('takes the role from the mean colour of the cell', () => {
    const colormap = createColormap(cellId => (cellId === 3 ? [61, 166, 121] : [220, 220, 233]));
    const resolve = createVertexStyleResolver(colormap);

    expect(resolve(...toUv(3, 0.5)).role).toBe('green');
    expect(resolve(...toUv(4, 0.5)).role).toBe('light');
  });

  it('gives a flat cell the neutral shade', () => {
    const resolve = createVertexStyleResolver(createColormap(() => [142, 149, 179]));
    const shade = decodeWorldModelShade(resolve(...toUv(2, 0.3)).shadeByte);

    expect(Math.abs(shade - 1)).toBeLessThan(0.006);
  });

  it('makes the brighter end of a gradient lighter than its darker end', () => {
    const resolve = createVertexStyleResolver(createColormap((_, fraction) => {
      const level = 60 + fraction * 160;

      return [level, level, level];
    }));
    const dark = decodeWorldModelShade(resolve(...toUv(0, 0.05)).shadeByte);
    const bright = decodeWorldModelShade(resolve(...toUv(0, 0.95)).shadeByte);

    expect(dark).toBeLessThan(1);
    expect(bright).toBeGreaterThan(1);
  });

  it('clamps the shade to the format range', () => {
    const resolve = createVertexStyleResolver(createColormap((_, fraction) => (fraction < 0.9 ? [1, 1, 1] : [255, 255, 255])));
    const shade = decodeWorldModelShade(resolve(...toUv(0, 0.98)).shadeByte);

    expect(shade).toBeCloseTo(maxShade, 5);
    expect(decodeWorldModelShade(resolve(...toUv(0, 0.1)).shadeByte)).toBeCloseTo(minShade, 5);
  });

  it('falls back to the neutral shade for a black cell', () => {
    const resolve = createVertexStyleResolver(createColormap(() => [0, 0, 0]));

    expect(Math.abs(decodeWorldModelShade(resolve(...toUv(1, 0.5)).shadeByte) - 1)).toBeLessThan(0.006);
  });
});
