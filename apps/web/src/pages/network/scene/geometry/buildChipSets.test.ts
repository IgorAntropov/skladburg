import {
  Matrix4,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneBuildingValue } from '../layout';

import {
  buildChipSets,
  createChipHoverMasks,
  fillChipHoverMasks,
  findChipSlot,
  writeChipMarkerMatrices,
} from './buildChipSets';
import { applyChipAzimuth } from './chipOrientation';

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
    createBuilding({ id: 'a', side: 'customer', siteId: 'a', x: 5, z: -4 }),
    createBuilding({ id: 'b', side: 'supplier', siteId: 'b', x: 8.2, z: -4 }),
    createBuilding({ id: 'c', side: 'customer', siteId: 'c', x: 5, z: 3 }),
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

  it('keeps the site ids of every set in the order of its plates', () => {
    const { sets } = buildChipSets(buildings);

    expect(sets.map(set => set.siteIds)).toEqual([['a', 'c'], ['b'], []]);
  });

  it('finds the plate of a site and nothing for a city, a decor or a missing id', () => {
    const { sets } = buildChipSets(buildings);

    expect(findChipSlot(sets, 'c')).toEqual({ index: 1, setIndex: 0 });
    expect(findChipSlot(sets, 'b')).toEqual({ index: 0, setIndex: 1 });
    expect(findChipSlot(sets, 'city')).toBeUndefined();
    expect(findChipSlot(sets, 'decor')).toBeUndefined();
    expect(findChipSlot(sets, undefined)).toBeUndefined();
  });
});

describe('chip hover masks', () => {
  const buildings = [
    createBuilding({ id: 'a', side: 'customer', siteId: 'a', x: 5, z: -4 }),
    createBuilding({ id: 'b', side: 'supplier', siteId: 'b', x: 8.2, z: -4 }),
    createBuilding({ id: 'c', side: 'customer', siteId: 'c', x: 5, z: 3 }),
    createBuilding({ id: 'd', side: 'supplier', siteId: 'd', x: 8, z: 3 }),
  ];

  it('makes one zeroed mask per set, as long as the set', () => {
    const { sets } = buildChipSets(buildings);
    const masks = createChipHoverMasks(sets);

    expect(masks.map(mask => Array.from(mask))).toEqual([[0, 0], [0, 0], []]);
  });

  it('marks the hovered id together with every hovered site across the sets', () => {
    const { sets } = buildChipSets(buildings);
    const masks = createChipHoverMasks(sets);

    fillChipHoverMasks(masks, sets, 'a', ['d']);

    expect(masks.map(mask => Array.from(mask))).toEqual([[1, 0], [0, 1], []]);

    fillChipHoverMasks(masks, sets, undefined, ['b', 'c', 'b']);

    expect(masks.map(mask => Array.from(mask))).toEqual([[0, 1], [1, 0], []]);
  });

  it('ignores cities, unknown ids and hidden sites and clears the previous marks', () => {
    const { sets } = buildChipSets(buildings);
    const masks = createChipHoverMasks(sets);

    fillChipHoverMasks(masks, sets, 'a', ['b']);
    fillChipHoverMasks(masks, sets, 'city', ['ghost']);

    expect(masks.map(mask => Array.from(mask))).toEqual([[0, 0], [0, 0], []]);
  });

  it('writes the same buffer in place without replacing the masks', () => {
    const { sets } = buildChipSets(buildings);
    const masks = createChipHoverMasks(sets);
    const first = masks[0];

    fillChipHoverMasks(masks, sets, 'c', []);

    expect(masks[0]).toBe(first);
  });
});

describe('own site markers', () => {
  const buildings = [
    createBuilding({ id: 'a', isOwn: true, side: 'customer', x: 5, z: -4 }),
    createBuilding({ id: 'b', isOwn: false, side: 'supplier', x: 8.2, z: -4 }),
    createBuilding({ id: 'c', isOwn: true, side: 'carrier', x: 5, z: 3 }),
    createBuilding({ id: 'd', isOwn: false, side: 'customer', x: -5, z: 3 }),
  ];

  it('gives a marker only to the plates of own sites', () => {
    const { markers } = buildChipSets(buildings);

    expect(markers.count).toBe(2);
    expect(markers.matrices).toHaveLength(2 * 16);
    expect(markers.sources).toEqual([{ index: 0, setIndex: 0 }, { index: 0, setIndex: 2 }]);
  });

  it('has no markers when no site is own', () => {
    const { markers } = buildChipSets(buildings.map(building => ({ ...building, isOwn: false })));

    expect(markers.count).toBe(0);
    expect(markers.matrices).toHaveLength(0);
  });

  it('puts the marker 1.2 m right and 1.05 m up of the plate center on the plate frame', () => {
    const { markers, sets } = buildChipSets(buildings);

    applyChipAzimuth(sets[0]?.matrices ?? new Float32Array(), 2, Math.PI / 4, undefined);
    writeChipMarkerMatrices(markers, sets);

    const plate = new Matrix4().fromArray(sets[0]?.matrices ?? [], 0);
    const marker = new Matrix4().fromArray(markers.matrices, 0);
    const expected = new Vector3(1.2, 1.05, 0).applyMatrix4(plate);

    expect(new Vector3().setFromMatrixPosition(marker).distanceTo(expected)).toBeLessThan(1e-5);
    expect(new Vector3().setFromMatrixScale(marker).x).toBeCloseTo(1, 6);
    expect(new Vector3().setFromMatrixScale(marker).y).toBeCloseTo(1.2247449, 6);
  });

  it('follows the plate when it grows and rises under the cursor', () => {
    const { markers, sets } = buildChipSets(buildings);
    const customer = sets[0]?.matrices ?? new Float32Array();

    applyChipAzimuth(customer, 2, 0, Uint8Array.of(1, 0));
    writeChipMarkerMatrices(markers, sets);

    const plate = new Matrix4().fromArray(customer, 0);
    const marker = new Matrix4().fromArray(markers.matrices, 0);

    expect(new Vector3().setFromMatrixScale(marker).x).toBeCloseTo(1.25, 6);
    expect(new Vector3().setFromMatrixPosition(marker).distanceTo(new Vector3(1.2, 1.05, 0).applyMatrix4(plate))).toBeLessThan(1e-5);
    expect(new Vector3().setFromMatrixPosition(marker).y).toBeCloseTo(4.1 + 1.05 * 1.25 * 1.2247449, 5);
  });
});
