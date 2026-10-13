import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getBoardLayout,
  getBoardViewBox,
  RIM_DROP_METERS,
  RIM_THICKNESS_METERS,
  RIM_WIDTH_METERS,
  TILE_HEIGHT_METERS,
} from './getBoardLayout';

const BOUNDS = {
  maxX: 12,
  maxZ: 8,
  minX: -12,
  minZ: -8,
};

const getTop = (part: { position: number[]; scale: number[] }): number => {
  return (part.position[1] ?? 0) + (part.scale[1] ?? 0) / 2;
};

const getBottom = (part: { position: number[]; scale: number[] }): number => {
  return (part.position[1] ?? 0) - (part.scale[1] ?? 0) / 2;
};

describe('getBoardLayout', () => {
  it('puts the seam top flush with the tile bottoms and the body strictly below the seam', () => {
    const layout = getBoardLayout(BOUNDS);

    expect(getTop(layout.seam)).toBeCloseTo(0, 9);
    expect(getTop(layout.body)).toBeLessThanOrEqual(getBottom(layout.seam));
  });

  it('keeps the rim top below the body top so no top faces share a plane', () => {
    const layout = getBoardLayout(BOUNDS);

    expect(getTop(layout.rim)).toBeCloseTo(-RIM_DROP_METERS, 9);
    expect(getTop(layout.rim)).toBeLessThan(getTop(layout.body));
  });

  it('covers the tiled bounds exactly with the seam and nests the body and rim around it', () => {
    const layout = getBoardLayout(BOUNDS);

    expect(layout.seam.scale[0]).toBe(24);
    expect(layout.seam.scale[2]).toBe(16);
    expect(layout.body.scale[0]).toBeGreaterThan(layout.seam.scale[0]);
    expect(layout.rim.scale[0]).toBeGreaterThan(layout.body.scale[0]);
    expect(layout.rim.scale[2]).toBeGreaterThan(layout.body.scale[2]);
  });

  it('centers every part on the bounds center', () => {
    const layout = getBoardLayout({
      maxX: 10,
      maxZ: 6,
      minX: 2,
      minZ: 0,
    });

    [layout.body, layout.rim, layout.seam].forEach((part) => {
      expect(part.position[0]).toBe(6);
      expect(part.position[2]).toBe(3);
    });
  });
});

describe('getBoardViewBox', () => {
  it('extends the tiled bounds by the rim on both ground axes', () => {
    const viewBox = getBoardViewBox(BOUNDS);

    expect(viewBox.minX).toBeCloseTo(-12 - RIM_WIDTH_METERS, 9);
    expect(viewBox.maxX).toBeCloseTo(12 + RIM_WIDTH_METERS, 9);
    expect(viewBox.minZ).toBeCloseTo(-8 - RIM_WIDTH_METERS, 9);
    expect(viewBox.maxZ).toBeCloseTo(8 + RIM_WIDTH_METERS, 9);
  });

  it('spans from the bottom of the rim to the top of the tiles', () => {
    const viewBox = getBoardViewBox(BOUNDS);
    const layout = getBoardLayout(BOUNDS);

    expect(viewBox.maxY).toBe(TILE_HEIGHT_METERS);
    expect(viewBox.minY).toBeCloseTo(-RIM_DROP_METERS - RIM_THICKNESS_METERS, 9);
    expect(viewBox.minY).toBeCloseTo(getBottom(layout.rim), 9);
  });

  it('covers every part of the board', () => {
    const viewBox = getBoardViewBox(BOUNDS);
    const layout = getBoardLayout(BOUNDS);

    [layout.body, layout.rim, layout.seam].forEach((part) => {
      expect(getTop(part)).toBeLessThanOrEqual(viewBox.maxY);
      expect(getBottom(part)).toBeGreaterThanOrEqual(viewBox.minY - 1e-9);
      expect(part.position[0] - part.scale[0] / 2).toBeGreaterThanOrEqual(viewBox.minX - 1e-9);
      expect(part.position[2] + part.scale[2] / 2).toBeLessThanOrEqual(viewBox.maxZ + 1e-9);
    });
  });
});
