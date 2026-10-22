import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import {
  listSelectedIds,
  resolveSelectionFrames,
} from './selectionFrame';

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

const resolveSelectionFrame = (
  buildings: readonly NetworkSceneBuildingValue[],
  cities: readonly NetworkSceneCityValue[],
  id: string | undefined,
): ReturnType<typeof resolveSelectionFrames>[number] | undefined => (
  resolveSelectionFrames(buildings, cities, id === undefined ? [] : [id])[0]
);

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

describe('resolveSelectionFrames', () => {
  const OTHER_CITY: NetworkSceneCityValue = { ...CITY, cityId: 'kazan', hiddenSiteIds: ['hidden-3'], id: 'city-b', x: -30, z: 5 };
  const buildings = [
    createWarehouse({}),
    createWarehouse({ id: 'site-b', siteId: 'site-b', x: -4, z: 6 }),
    createWarehouse({ cityId: 'city-b', id: 'site-c', siteId: 'site-c', x: -31, z: 4 }),
  ];

  it('gives a frame to every site of the list, in the order of the list', () => {
    const frames = resolveSelectionFrames(buildings, [CITY, OTHER_CITY], ['site-c', 'site-a', 'site-b']);

    expect(frames.map(frame => [frame.centerX, frame.centerZ])).toEqual([[-31, 4], [10, 20], [-4, 6]]);
    expect(frames.every(frame => frame.barWidth === 0.3)).toBe(true);
  });

  it('does not frame the same site twice', () => {
    expect(resolveSelectionFrames(buildings, [CITY], ['site-a', 'site-a', 'site-b'])).toHaveLength(2);
  });

  it('gives a hidden site the frame of its city and draws it once for several hidden sites of one city', () => {
    const frames = resolveSelectionFrames(buildings, [CITY, OTHER_CITY], ['hidden-1', 'hidden-2', 'hidden-3']);

    expect(frames).toHaveLength(2);
    expect(frames.map(frame => [frame.centerX, frame.centerZ])).toEqual([[8, 18], [-30, 5]]);
    expect(frames.every(frame => frame.barWidth === 0.4)).toBe(true);
  });

  it('draws the frame of a city once when a hidden site and the city itself are in the list', () => {
    expect(resolveSelectionFrames(buildings, [CITY], ['hidden-1', 'city-a', 'site-a'])).toHaveLength(2);
  });

  it('mixes visible sites with hidden ones and skips the unknown ids', () => {
    const frames = resolveSelectionFrames(buildings, [CITY], ['site-a', 'ghost', 'hidden-1']);

    expect(frames.map(frame => frame.barWidth)).toEqual([0.3, 0.4]);
  });

  it('gives no frames for an empty list', () => {
    expect(resolveSelectionFrames(buildings, [CITY], [])).toEqual([]);
  });
});

describe('listSelectedIds', () => {
  it('gives no ids without a selection, always the same empty list', () => {
    expect(listSelectedIds(undefined)).toEqual([]);
    expect(listSelectedIds(undefined)).toBe(listSelectedIds(undefined));
  });

  it('gives the id of a selected site or city', () => {
    expect(listSelectedIds({ id: 'site-a', kind: 'site' })).toEqual(['site-a']);
    expect(listSelectedIds({ id: 'city-a', kind: 'city' })).toEqual(['city-a']);
  });

  it('gives the sites of a selected group and not its own id', () => {
    const siteIds = ['site-a', 'site-b'];

    expect(listSelectedIds({ id: 'organization', kind: 'sites', siteIds })).toBe(siteIds);
  });
});
