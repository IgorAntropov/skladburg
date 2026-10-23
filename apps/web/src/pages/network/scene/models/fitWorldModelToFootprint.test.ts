import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldModelBoundsValue } from './format/worldModelFormat';

import { fitWorldModelToFootprint } from './fitWorldModelToFootprint';

const WAREHOUSE_BOUNDS: WorldModelBoundsValue = { max: [0.65, 0.9, 0.39], min: [-0.65, 0, -0.39] };

const createFootprint = (
  overrides: Partial<{ depth: number; height: number; rotation: number; width: number }> = {},
): { depth: number; height: number; rotation: number; width: number } => ({
  depth: 1.5,
  height: 1.5,
  rotation: 0.3,
  width: 2.4,
  ...overrides,
});

const measure = (bounds: WorldModelBoundsValue, scale: readonly [number, number, number]): [number, number, number] => [
  (bounds.max[0] - bounds.min[0]) * scale[0],
  (bounds.max[1] - bounds.min[1]) * scale[1],
  (bounds.max[2] - bounds.min[2]) * scale[2],
];

describe('fitWorldModelToFootprint', () => {
  it('fills the footprint exactly along both axes without a turn when the proportions agree', () => {
    const fit = fitWorldModelToFootprint(WAREHOUSE_BOUNDS, createFootprint());
    const [width, , depth] = measure(WAREHOUSE_BOUNDS, fit.scale);

    expect(fit.rotationY).toBeCloseTo(0.3, 6);
    expect(width).toBeCloseTo(2.4, 6);
    expect(depth).toBeCloseTo(1.5, 6);
  });

  it('turns the model a quarter when the footprint is the other way round', () => {
    const fit = fitWorldModelToFootprint(WAREHOUSE_BOUNDS, createFootprint({ depth: 2.4, width: 1.5 }));
    const [alongModelWidth, , alongModelDepth] = measure(WAREHOUSE_BOUNDS, fit.scale);

    expect(fit.rotationY).toBeCloseTo(0.3 + Math.PI / 2, 6);
    expect(alongModelWidth).toBeCloseTo(2.4, 6);
    expect(alongModelDepth).toBeCloseTo(1.5, 6);
  });

  it('does not turn when both ways stretch the model the same', () => {
    const square: WorldModelBoundsValue = { max: [1, 1, 1], min: [-1, 0, -1] };
    const fit = fitWorldModelToFootprint(square, createFootprint({ depth: 2, rotation: 0, width: 2 }));

    expect(fit.rotationY).toBe(0);
  });

  it('chooses the turn with the smaller stretch', () => {
    const fit = fitWorldModelToFootprint(WAREHOUSE_BOUNDS, createFootprint({ depth: 2, rotation: 0, width: 1.6 }));
    const stretch = Math.max(fit.scale[0], fit.scale[2]) / Math.min(fit.scale[0], fit.scale[2]);

    expect(fit.rotationY).toBeCloseTo(Math.PI / 2, 6);
    expect(stretch).toBeLessThan(1.4);
  });

  it('makes the height the mean of the scales of the footprint', () => {
    const fit = fitWorldModelToFootprint(WAREHOUSE_BOUNDS, createFootprint({ height: 9 }));

    expect(fit.scale[1]).toBeCloseTo((fit.scale[0] + fit.scale[2]) / 2, 6);
  });

  it('never rises above the height of the building', () => {
    const fit = fitWorldModelToFootprint(WAREHOUSE_BOUNDS, createFootprint({ height: 0.9 }));
    const [, height] = measure(WAREHOUSE_BOUNDS, fit.scale);

    expect(height).toBeCloseTo(0.9, 6);
  });
});
