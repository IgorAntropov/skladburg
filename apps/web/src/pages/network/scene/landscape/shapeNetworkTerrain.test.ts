import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldTerrainValue } from '@/shared/3d';

import { selectNetworkLand } from './selectNetworkLand';
import { shapeNetworkTerrain } from './shapeNetworkTerrain';

const createTerrain = (): WorldTerrainValue => ({
  decor: [],
  forestShare: 0,
  groundGroups: [
    { count: 3, key: 'field', start: 0 },
    { count: 3, key: 'water', start: 3 },
  ],
  groundIndex: Uint16Array.from([0, 1, 2, 3, 4, 5]),
  groundPositions: Float32Array.from([
    2, 0, 0,
    2, 0, 2,
    0, 0, 2,
    0, 0, 0,
    2, 0, 0,
    0, 0, 2,
  ]),
  groundWeights: Uint8Array.from([
    5, 0, 250, 0, 0,
    5, 0, 250, 0, 0,
    0, 0, 215, 0, 40,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
  ]),
  triangleCount: 2,
});

const readPosition = (positions: Float32Array, vertex: number): number[] => [...positions.slice(vertex * 3, (vertex + 1) * 3)];

describe('shapeNetworkTerrain', () => {
  it('moves the shore together on both surfaces and leaves isolated outer vertices in place', () => {
    const source = createTerrain();
    const terrain = shapeNetworkTerrain(source);

    expect(readPosition(terrain.groundPositions, 0)).not.toEqual(readPosition(source.groundPositions, 0));
    expect(readPosition(terrain.groundPositions, 0)).toEqual(readPosition(terrain.groundPositions, 4));
    expect(readPosition(terrain.groundPositions, 2)).toEqual(readPosition(terrain.groundPositions, 5));
    expect(readPosition(terrain.groundPositions, 1)).toEqual([2, 0, 2]);
    expect(readPosition(terrain.groundPositions, 3)).toEqual([0, 0, 0]);
    expect(terrain.groundIndex).toBe(source.groundIndex);
    expect(terrain.triangleCount).toBe(source.triangleCount);
  });

  it('varies crop tone while keeping total land and sand weights and reuses the prepared terrain', () => {
    const source = createTerrain();
    const terrain = shapeNetworkTerrain(source);

    expect(terrain.groundWeights[2]).toBeLessThan(250);
    expect(terrain.groundWeights[2]).not.toBe(terrain.groundWeights[7]);
    expect(terrain.groundWeights[14]).toBe(40);

    for (let vertex = 0; vertex < 3; vertex += 1) {
      expect(terrain.groundWeights.slice(vertex * 5, (vertex + 1) * 5).reduce((sum, value) => sum + value, 0)).toBe(255);
    }

    expect(source.groundWeights[2]).toBe(250);
    expect(shapeNetworkTerrain(source)).toBe(terrain);
  });
});

describe('selectNetworkLand', () => {
  it('keeps the beach and grass indices in order while excluding the field and water faces', () => {
    const source = {
      ...createTerrain(),
      groundGroups: [
        { count: 3, key: 'ground', start: 0 },
        { count: 3, key: 'fieldAlt', start: 3 },
        { count: 3, key: 'sand', start: 6 },
        { count: 3, key: 'water', start: 9 },
      ],
      groundIndex: Uint16Array.from([0, 1, 2, 2, 3, 4, 3, 4, 5, 1, 4, 5]),
    } satisfies WorldTerrainValue;

    const land = selectNetworkLand(source);

    expect(land.groundGroups).toEqual([{ count: 3, key: 'ground', start: 0 }, { count: 3, key: 'sand', start: 3 }]);
    expect(land.groundIndex).toEqual(Uint16Array.from([0, 1, 2, 3, 4, 5]));
    expect(source.groundIndex).toHaveLength(12);
  });
});
