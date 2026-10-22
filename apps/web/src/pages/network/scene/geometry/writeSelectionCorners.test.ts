import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SelectionFrameValue } from './selectionFrame';

import {
  SELECTION_CORNER_INSTANCE_COUNT,
  writeSelectionCorners,
  writeSelectionFrames,
} from './writeSelectionCorners';

interface BarRectValue {
  bottom: number;
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
  top: number;
}

const SITE_FRAME: SelectionFrameValue = {
  barLength: 1,
  barWidth: 0.3,
  centerX: 10,
  centerZ: -4,
  innerHalfX: 1.5,
  innerHalfZ: 1.25,
};

const CITY_FRAME: SelectionFrameValue = {
  barLength: 2.2,
  barWidth: 0.4,
  centerX: 0,
  centerZ: 0,
  innerHalfX: 5.12,
  innerHalfZ: 5.12,
};

const readBars = (matrices: Float32Array): BarRectValue[] => {
  const bars: BarRectValue[] = [];

  for (let index = 0; index < SELECTION_CORNER_INSTANCE_COUNT; index += 1) {
    const offset = index * 16;
    const halfX = (matrices[offset] ?? 0) / 2;
    const halfZ = (matrices[offset + 10] ?? 0) / 2;
    const x = matrices[offset + 12] ?? 0;
    const z = matrices[offset + 14] ?? 0;
    const bottom = matrices[offset + 13] ?? 0;

    bars.push({
      bottom,
      maxX: x + halfX,
      maxZ: z + halfZ,
      minX: x - halfX,
      minZ: z - halfZ,
      top: bottom + (matrices[offset + 5] ?? 0),
    });
  }

  return bars;
};

const write = (frame: SelectionFrameValue, spread: number): { dark: BarRectValue[]; light: BarRectValue[] } => {
  const light = new Float32Array(SELECTION_CORNER_INSTANCE_COUNT * 16);
  const dark = new Float32Array(SELECTION_CORNER_INSTANCE_COUNT * 16);

  writeSelectionCorners(frame, spread, light, dark, 0);

  return { dark: readBars(dark), light: readBars(light) };
};

const getExtent = (bars: readonly BarRectValue[], frame: SelectionFrameValue): { x: number; z: number } => ({
  x: Math.max(...bars.map(bar => Math.max(bar.maxX - frame.centerX, frame.centerX - bar.minX))),
  z: Math.max(...bars.map(bar => Math.max(bar.maxZ - frame.centerZ, frame.centerZ - bar.minZ))),
});

describe('writeSelectionCorners', () => {
  it('writes eight bars per layer: two for each of four corners', () => {
    const { dark, light } = write(SITE_FRAME, 0);

    expect(dark).toHaveLength(8);
    expect(light).toHaveLength(8);
  });

  it('frames a 2.0 by 1.5 m warehouse with a light ring of 3.6 by 3.1 m and a dark one of 3.84 by 3.34 m', () => {
    const { dark, light } = write(SITE_FRAME, 0);
    const lightExtent = getExtent(light, SITE_FRAME);
    const darkExtent = getExtent(dark, SITE_FRAME);

    expect(lightExtent.x * 2).toBeCloseTo(3.6, 6);
    expect(lightExtent.z * 2).toBeCloseTo(3.1, 6);
    expect(darkExtent.x * 2).toBeCloseTo(3.84, 6);
    expect(darkExtent.z * 2).toBeCloseTo(3.34, 6);
  });

  it('keeps every bar at least 0.5 m away from the footprint of the warehouse', () => {
    const { light } = write(SITE_FRAME, 0);
    const footprint = { maxX: 11, maxZ: -3.25, minX: 9, minZ: -4.75 };

    for (const bar of light) {
      const gapX = Math.max(bar.minX - footprint.maxX, footprint.minX - bar.maxX, 0);
      const gapZ = Math.max(bar.minZ - footprint.maxZ, footprint.minZ - bar.maxZ, 0);

      expect(Math.max(gapX, gapZ)).toBeGreaterThanOrEqual(0.5 - 1e-6);
    }
  });

  it('makes corners 1.0 m long along each side, measured from the outer edge', () => {
    const { light } = write(SITE_FRAME, 0);
    const horizontal = light.filter(bar => bar.maxX - bar.minX > bar.maxZ - bar.minZ);
    const vertical = light.filter(bar => bar.maxX - bar.minX < bar.maxZ - bar.minZ);

    expect(horizontal).toHaveLength(4);
    expect(vertical).toHaveLength(4);
    expect(horizontal.every(bar => Math.abs(bar.maxX - bar.minX - 1) < 1e-6)).toBe(true);
    expect(vertical.every(bar => Math.abs(bar.maxZ - bar.minZ - 0.7) < 1e-6)).toBe(true);
  });

  it('puts the dark bar 0.12 m wider than the light one on every side and under it', () => {
    const { dark, light } = write(SITE_FRAME, 0);

    for (const [index, bar] of light.entries()) {
      const under = dark[index];

      expect(bar.minX - (under?.minX ?? 0)).toBeCloseTo(0.12, 6);
      expect((under?.maxZ ?? 0) - bar.maxZ).toBeCloseTo(0.12, 6);
      expect(under?.bottom).toBeCloseTo(0.12, 6);
      expect(under?.top).toBeCloseTo(0.14, 6);
      expect(bar.bottom).toBeCloseTo(0.12, 6);
      expect(bar.top).toBeCloseTo(0.16, 6);
    }
  });

  it('keeps the vertices of a city frame within 8.4 m of the center', () => {
    const { dark } = write(CITY_FRAME, 0);
    const reach = Math.max(...dark.flatMap(bar => [
      Math.hypot(bar.minX, bar.minZ),
      Math.hypot(bar.maxX, bar.minZ),
      Math.hypot(bar.minX, bar.maxZ),
      Math.hypot(bar.maxX, bar.maxZ),
    ]));

    expect(reach).toBeCloseTo(7.98, 2);
    expect(reach).toBeLessThanOrEqual(8.4);
  });

  it('moves every corner out by the spread along both axes', () => {
    const calm = write(SITE_FRAME, 0).light;
    const spread = write(SITE_FRAME, 0.3).light;
    const extent = getExtent(spread, SITE_FRAME);

    expect(extent.x).toBeCloseTo(getExtent(calm, SITE_FRAME).x + 0.3, 6);
    expect(extent.z).toBeCloseTo(getExtent(calm, SITE_FRAME).z + 0.3, 6);
  });

  it('writes the frame at its index after the instances of the earlier frames', () => {
    const light = new Float32Array(SELECTION_CORNER_INSTANCE_COUNT * 2 * 16);
    const dark = new Float32Array(SELECTION_CORNER_INSTANCE_COUNT * 2 * 16);

    writeSelectionCorners(SITE_FRAME, 0, light, dark, 1);

    expect(light.subarray(0, SELECTION_CORNER_INSTANCE_COUNT * 16).every(value => value === 0)).toBe(true);
    expect(dark.subarray(0, SELECTION_CORNER_INSTANCE_COUNT * 16).every(value => value === 0)).toBe(true);

    const second = readBars(light.subarray(SELECTION_CORNER_INSTANCE_COUNT * 16));

    expect(getExtent(second, SITE_FRAME).x * 2).toBeCloseTo(3.6, 6);
  });
});

describe('writeSelectionFrames', () => {
  it('writes a set of eight bars for every frame, each around its own center and with the same spread', () => {
    const light = new Float32Array(SELECTION_CORNER_INSTANCE_COUNT * 2 * 16);
    const dark = new Float32Array(SELECTION_CORNER_INSTANCE_COUNT * 2 * 16);

    writeSelectionFrames([SITE_FRAME, CITY_FRAME], 0.3, light, dark);

    const first = readBars(light);
    const second = readBars(light.subarray(SELECTION_CORNER_INSTANCE_COUNT * 16));

    expect(getExtent(first, SITE_FRAME).x).toBeCloseTo(1.8 + 0.3, 6);
    expect(getExtent(second, CITY_FRAME).x).toBeCloseTo(5.52 + 0.3, 6);
    expect(readBars(dark.subarray(SELECTION_CORNER_INSTANCE_COUNT * 16))).toHaveLength(8);
  });

  it('writes nothing for no frames', () => {
    const light = new Float32Array(16);
    const dark = new Float32Array(16);

    writeSelectionFrames([], 0, light, dark);

    expect(light.every(value => value === 0)).toBe(true);
  });
});
