import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneBuildingValue } from './networkSceneTypes';

import {
  getVisibleBuildingCount,
  isBuildingVisible,
  orderBuildingsForDensity,
} from './buildingVisibility';

const createBuilding = (id: string, isCompany: boolean, rank: number): NetworkSceneBuildingValue => ({
  cityId: 'a',
  depth: 1,
  height: 1,
  id,
  isCompany,
  isOwn: false,
  kind: isCompany ? 'warehouse' : 'house',
  rank,
  rotation: 0,
  side: undefined,
  siteId: undefined,
  width: 1,
  x: 0,
  z: 0,
});

describe('building visibility', () => {
  it('always shows company buildings and cuts decor by rank', () => {
    expect(isBuildingVisible({ isCompany: true, rank: 0.99 }, 0)).toBe(true);
    expect(isBuildingVisible({ isCompany: false, rank: 0.29 }, 0.3)).toBe(true);
    expect(isBuildingVisible({ isCompany: false, rank: 0.3 }, 0.3)).toBe(false);
    expect(isBuildingVisible({ isCompany: false, rank: 0.99 }, 1)).toBe(true);
  });

  it('orders companies first and decor by rank so that the visible ones are a prefix', () => {
    const ordered = orderBuildingsForDensity([
      createBuilding('d-high', false, 0.9),
      createBuilding('w-1', true, 0),
      createBuilding('d-low', false, 0.1),
      createBuilding('d-mid', false, 0.5),
      createBuilding('w-2', true, 0),
    ]);

    expect(ordered.map(building => building.id)).toEqual(['w-1', 'w-2', 'd-low', 'd-mid', 'd-high']);
    expect(getVisibleBuildingCount(ordered, 0.3)).toBe(3);
    expect(getVisibleBuildingCount(ordered, 0.6)).toBe(4);
    expect(getVisibleBuildingCount(ordered, 1)).toBe(5);
    expect(getVisibleBuildingCount(ordered, 0)).toBe(2);
  });

  it('counts nothing in an empty list', () => {
    expect(getVisibleBuildingCount([], 1)).toBe(0);
  });
});
