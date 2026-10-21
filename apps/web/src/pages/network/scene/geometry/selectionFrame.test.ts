import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import { resolveSelectionFrame } from './selectionFrame';

const createWarehouse = (overrides: Partial<NetworkSceneBuildingValue>): NetworkSceneBuildingValue => ({
  cityId: 'city-a',
  depth: 1.5,
  height: 1.5,
  id: 'site-a',
  isCompany: true,
  isOwn: false,
  kind: 'warehouse',
  rank: 0,
  rotation: 0,
  side: 'customer',
  siteId: 'site-a',
  width: 2,
  x: 10,
  z: 20,
  ...overrides,
});

const CITY: NetworkSceneCityValue = {
  cityId: 'moscow',
  hiddenSiteIds: ['hidden-1', 'hidden-2'],
  id: 'city-a',
  name: 'Москва',
  radius: 6.4,
  x: 8,
  z: 18,
};

describe('resolveSelectionFrame', () => {
  const buildings = [
    createWarehouse({}),
    createWarehouse({ id: 'site-b', rotation: Math.PI / 2, siteId: 'site-b', x: -4, z: 6 }),
    createWarehouse({ id: 'house', isCompany: false, kind: 'house', side: undefined, siteId: undefined }),
  ];

  it('frames a site 0.5 m off the footprint of its warehouse', () => {
    expect(resolveSelectionFrame(buildings, [CITY], 'site-a')).toEqual({
      barLength: 1,
      barWidth: 0.3,
      centerX: 10,
      centerZ: 20,
      innerHalfX: 1.5,
      innerHalfZ: 1.25,
    });
  });

  it('swaps the width and the depth of a warehouse turned a quarter', () => {
    const frame = resolveSelectionFrame(buildings, [CITY], 'site-b');

    expect(frame?.innerHalfX).toBeCloseTo(1.25, 6);
    expect(frame?.innerHalfZ).toBeCloseTo(1.5, 6);
    expect([frame?.centerX, frame?.centerZ]).toEqual([-4, 6]);
  });

  it('frames a city at 0.8 of its radius from the center', () => {
    const frame = resolveSelectionFrame(buildings, [CITY], 'city-a');

    expect(frame?.innerHalfX).toBeCloseTo(5.12, 6);
    expect(frame?.innerHalfZ).toBeCloseTo(5.12, 6);
    expect(frame?.barWidth).toBe(0.4);
    expect(frame?.barLength).toBe(2.2);
    expect([frame?.centerX, frame?.centerZ]).toEqual([8, 18]);
  });

  it('frames the city of a site hidden by an overflow', () => {
    expect(resolveSelectionFrame(buildings, [CITY], 'hidden-2')).toEqual(resolveSelectionFrame(buildings, [CITY], 'city-a'));
  });

  it('keeps the frame of a crowded city inside its cleared meadow', () => {
    const frame = resolveSelectionFrame(buildings, [{ ...CITY, radius: 8 }], 'city-a');
    const outer = (frame?.innerHalfX ?? 0) + 0.4 + 0.12;

    expect(Math.hypot(outer, outer)).toBeLessThanOrEqual(8.4 + 1e-9);
  });

  it('gives no frame for a decor building, an unknown id or no selection', () => {
    expect(resolveSelectionFrame(buildings, [CITY], 'house')).toBeUndefined();
    expect(resolveSelectionFrame(buildings, [CITY], 'nobody')).toBeUndefined();
    expect(resolveSelectionFrame(buildings, [CITY], undefined)).toBeUndefined();
  });
});
