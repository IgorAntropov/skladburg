import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  LAMP_HALO_SHELL_RADII_METERS,
  LAMP_POOL_DISC_RADII_METERS,
} from '../night';
import {
  createLampHaloGeometry,
  createLampPoolGeometry,
} from './createLampLightGeometry';

const readVertex = (array: ArrayLike<number>, index: number): [number, number, number] => [
  array[index * 3] ?? 0,
  array[index * 3 + 1] ?? 0,
  array[index * 3 + 2] ?? 0,
];

describe('createLampPoolGeometry', () => {
  it('joins three 16-sided discs into one geometry of 48 triangles', () => {
    const geometry = createLampPoolGeometry();
    const indexCount = geometry.index?.count ?? 0;

    expect(LAMP_POOL_DISC_RADII_METERS).toHaveLength(3);
    expect(indexCount / 3).toBe(48);
  });

  it('lays the discs flat in one plane at the origin with the normals up', () => {
    const geometry = createLampPoolGeometry();
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');

    for (let index = 0; index < position.count; index += 1) {
      const [, y] = readVertex(position.array, index);
      const [normalX, normalY, normalZ] = readVertex(normal.array, index);

      expect(y).toBeCloseTo(0, 6);
      expect(normalX).toBeCloseTo(0, 6);
      expect(normalY).toBeCloseTo(1, 6);
      expect(normalZ).toBeCloseTo(0, 6);
    }
  });

  it('reaches exactly the radii of the discs and no further', () => {
    const geometry = createLampPoolGeometry();
    const position = geometry.getAttribute('position');
    const reaches = new Set<number>();

    for (let index = 0; index < position.count; index += 1) {
      const [x, , z] = readVertex(position.array, index);

      reaches.add(Math.round(Math.hypot(x, z) * 1000) / 1000);
    }

    expect([...reaches].toSorted((current, prev) => current - prev)).toEqual([
      0,
      ...LAMP_POOL_DISC_RADII_METERS.toSorted((current, prev) => current - prev),
    ]);
  });

  it('winds the triangles so that they face up', () => {
    const geometry = createLampPoolGeometry();
    const position = geometry.getAttribute('position');
    const indices = geometry.index?.array ?? [];

    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      const [ax, , az] = readVertex(position.array, indices[triangle] ?? 0);
      const [bx, , bz] = readVertex(position.array, indices[triangle + 1] ?? 0);
      const [cx, , cz] = readVertex(position.array, indices[triangle + 2] ?? 0);
      const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);

      expect(normalY).toBeGreaterThan(0);
    }
  });
});

describe('createLampHaloGeometry', () => {
  it('joins two shells of 80 triangles into one geometry', () => {
    const geometry = createLampHaloGeometry();

    expect(LAMP_HALO_SHELL_RADII_METERS).toHaveLength(2);
    expect(geometry.index).toBeNull();
    expect(geometry.getAttribute('position').count / 3).toBe(160);
  });

  it('keeps every vertex on one of the shell radii around the origin', () => {
    const geometry = createLampHaloGeometry();
    const position = geometry.getAttribute('position');
    const reaches = new Set<number>();

    for (let index = 0; index < position.count; index += 1) {
      const [x, y, z] = readVertex(position.array, index);

      reaches.add(Math.round(Math.hypot(x, y, z) * 1000) / 1000);
    }

    expect([...reaches].toSorted((current, prev) => current - prev)).toEqual(
      LAMP_HALO_SHELL_RADII_METERS.toSorted((current, prev) => current - prev),
    );
  });
});
