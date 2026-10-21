import { Vector3 } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneBuildingValue } from '../layout';

import { buildChipSets } from './buildChipSets';

const createBuilding = (overrides: Partial<NetworkSceneBuildingValue>): NetworkSceneBuildingValue => ({
  cityId: 'city',
  depth: 1.5,
  height: 1.5,
  id: 'warehouse',
  isCompany: true,
  isOwn: false,
  kind: 'warehouse',
  rank: 0,
  rotation: 0,
  side: 'customer',
  siteId: 'warehouse',
  width: 2,
  x: 5,
  z: -4,
  ...overrides,
});

describe('buildChipSets', () => {
  const buildings = [
    createBuilding({ id: 'a', side: 'customer', x: 5, z: -4 }),
    createBuilding({ id: 'b', side: 'supplier', x: 8.2, z: -4 }),
    createBuilding({ id: 'c', side: 'customer', x: 5, z: 3 }),
    createBuilding({ id: 'decor', isCompany: false, kind: 'house', side: undefined, siteId: undefined }),
  ];

  it('makes one set per side with a plate for every company building of that side', () => {
    const { sets } = buildChipSets(buildings);

    expect(sets.map(set => [set.side, set.count, set.matrices.length])).toEqual([
      ['customer', 2, 32],
      ['supplier', 1, 16],
      ['carrier', 0, 0],
    ]);
  });

  it('centers every plate over its building at 3.7 m', () => {
    const customer = buildChipSets(buildings).sets[0];

    const first = new Vector3().fromArray(customer?.matrices ?? [], 12);
    const second = new Vector3().fromArray(customer?.matrices ?? [], 28);

    expect([first.x, first.y, first.z]).toEqual([5, expect.closeTo(3.7, 5), -4]);
    expect([second.x, second.y, second.z]).toEqual([5, expect.closeTo(3.7, 5), 3]);
  });

  it('puts a post from the ridge to 2.5 m under every plate and none under decor', () => {
    const { postMatrices } = buildChipSets(buildings);
    const position = new Vector3().fromArray(postMatrices, 12);

    expect(postMatrices).toHaveLength(3 * 16);
    expect(position.x).toBeCloseTo(5, 5);
    expect(position.y).toBeCloseTo(1.6, 5);
    expect(postMatrices[5]).toBeCloseTo(0.9, 5);
    expect(postMatrices[0]).toBeCloseTo(0.16, 5);
  });

  it('returns empty buffers when there are no company buildings', () => {
    const { postMatrices, sets } = buildChipSets([]);

    expect(postMatrices).toHaveLength(0);
    expect(sets.every(set => set.count === 0)).toBe(true);
  });
});
