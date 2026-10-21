import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildRoadStrips } from './buildRoadStrips';

const ROAD = { from: { x: 0, z: 0 }, to: { x: 10, z: 0 } };
const DIAGONAL = { from: { x: -4, z: -3 }, to: { x: 20, z: 15 } };

const getNormalY = (positions: Float32Array, indices: Uint16Array, triangle: number): number => {
  const read = (index: number): [number, number, number] => [
    positions[index * 3] ?? 0,
    positions[index * 3 + 1] ?? 0,
    positions[index * 3 + 2] ?? 0,
  ];
  const [a, b, c] = [read(indices[triangle * 3] ?? 0), read(indices[triangle * 3 + 1] ?? 0), read(indices[triangle * 3 + 2] ?? 0)];

  return (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
};

describe('buildRoadStrips', () => {
  it('builds four vertices and two triangles per road', () => {
    const { indices, normals, positions } = buildRoadStrips([ROAD, DIAGONAL], 2, 0.04);

    expect(positions).toHaveLength(2 * 4 * 3);
    expect(normals).toHaveLength(positions.length);
    expect(indices).toHaveLength(2 * 6);
  });

  it('puts every vertex at the given height with an upward normal', () => {
    const { normals, positions } = buildRoadStrips([ROAD, DIAGONAL], 2, 0.04);

    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      expect(positions[vertex * 3 + 1]).toBeCloseTo(0.04, 6);
      expect([normals[vertex * 3], normals[vertex * 3 + 1], normals[vertex * 3 + 2]]).toEqual([0, 1, 0]);
    }
  });

  it('is as wide as asked across the road and as long as the road along it', () => {
    const { positions } = buildRoadStrips([DIAGONAL], 2, 0.04);
    const corner = (index: number): [number, number] => [positions[index * 3] ?? 0, positions[index * 3 + 2] ?? 0];
    const middle = (first: number, second: number): [number, number] => [
      (corner(first)[0] + corner(second)[0]) / 2,
      (corner(first)[1] + corner(second)[1]) / 2,
    ];
    const distance = (first: [number, number], second: [number, number]): number => Math.hypot(first[0] - second[0], first[1] - second[1]);

    expect(distance(corner(0), corner(3))).toBeCloseTo(2, 5);
    expect(distance(corner(1), corner(2))).toBeCloseTo(2, 5);
    expect(distance(middle(0, 3), middle(1, 2))).toBeCloseTo(Math.hypot(24, 18), 5);
  });

  it('faces every triangle up for roads in any direction', () => {
    const roads = [
      ROAD,
      DIAGONAL,
      { from: { x: 5, z: 5 }, to: { x: -5, z: 5 } },
      { from: { x: 0, z: 9 }, to: { x: 0, z: -9 } },
    ];
    const { indices, positions } = buildRoadStrips(roads, 2, 0.04);

    for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
      expect(getNormalY(positions, indices, triangle)).toBeGreaterThan(0);
    }
  });

  it('skips roads without length and returns empty buffers for no roads', () => {
    expect(buildRoadStrips([{ from: { x: 3, z: 3 }, to: { x: 3, z: 3 } }], 2, 0.04).indices).toHaveLength(0);
    expect(buildRoadStrips([], 2, 0.04).positions).toHaveLength(0);
  });
});
