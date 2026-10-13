import type { BufferGeometry } from 'three';

import { Box3 } from 'three';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { TERRAIN_DECOR_SHAPES } from '../terrain/terrainDecorShapes';
import { createWorldGeometryRegistry } from './createWorldGeometryRegistry';

const measure = (geometry: BufferGeometry): Box3 => {
  geometry.computeBoundingBox();

  return geometry.boundingBox ?? new Box3();
};

describe('createWorldGeometryRegistry', () => {
  it('returns one shared geometry per key', () => {
    const registry = createWorldGeometryRegistry();

    expect(registry.get('rock')).toBe(registry.get('rock'));
    expect(registry.get('rock')).not.toBe(registry.get('coniferCrown'));
  });

  it('stands both trunks on the ground at the height of their shape', () => {
    const registry = createWorldGeometryRegistry();

    for (const [key, shape] of [
      ['deciduousTrunk', TERRAIN_DECOR_SHAPES.deciduous],
      ['coniferTrunk', TERRAIN_DECOR_SHAPES.conifer],
    ] as const) {
      const box = measure(registry.get(key));

      expect(box.min.y).toBeCloseTo(0, 6);
      expect(box.max.y).toBeCloseTo(shape.trunkHeight, 6);
      expect(box.max.x).toBeLessThanOrEqual(shape.trunkRadius + 1e-6);
      expect(box.max.x).toBeGreaterThan(shape.trunkRadius * 0.8);
    }
  });

  it('centers the broad crown at its height and spans the cone between its base and its tip', () => {
    const registry = createWorldGeometryRegistry();
    const { conifer, deciduous } = TERRAIN_DECOR_SHAPES;
    const broad = measure(registry.get('deciduousCrown'));
    const cone = measure(registry.get('coniferCrown'));

    expect((broad.min.y + broad.max.y) / 2).toBeCloseTo(deciduous.crownCenterHeight, 6);
    expect(broad.max.y - broad.min.y).toBeLessThanOrEqual(deciduous.crownRadius * 2 + 1e-6);
    expect(cone.min.y).toBeCloseTo(conifer.crownBaseHeight, 6);
    expect(cone.max.y).toBeCloseTo(conifer.crownBaseHeight + conifer.crownHeight, 6);
    expect(cone.max.x).toBeLessThanOrEqual(conifer.crownRadius + 1e-6);
  });

  it('centers the rock on the origin within its radius', () => {
    const box = measure(createWorldGeometryRegistry().get('rock'));
    const { radius } = TERRAIN_DECOR_SHAPES.rock;

    expect(box.min.y).toBeGreaterThanOrEqual(-radius - 1e-6);
    expect(box.max.y).toBeLessThanOrEqual(radius + 1e-6);
    expect(box.min.x + box.max.x).toBeCloseTo(0, 6);
  });

  it('disposes every created geometry and no other', () => {
    const registry = createWorldGeometryRegistry();
    const rock = registry.get('rock');
    const trunk = registry.get('coniferTrunk');
    const rockDispose = vi.spyOn(rock, 'dispose');
    const trunkDispose = vi.spyOn(trunk, 'dispose');

    registry.dispose();

    expect(rockDispose).toHaveBeenCalledTimes(1);
    expect(trunkDispose).toHaveBeenCalledTimes(1);
  });
});
