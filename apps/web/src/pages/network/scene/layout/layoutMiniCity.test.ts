import {
  describe,
  expect,
  it,
} from 'vitest';

import type { MiniCitySiteValue } from './layoutMiniCity';
import type { NetworkSceneBuildingValue } from './networkSceneTypes';

import {
  COMPANY_MIN_SPACING_METERS,
  DECOR_MAX_COUNT,
  HOUSE_SIZE_RANGE_METERS,
  MINI_CITY_OVERFLOW_RADIUS_METERS,
  MINI_CITY_RADIUS_METERS,
  OFFICE_SIZE_RANGE_METERS,
} from './layoutConstants';
import { layoutMiniCity } from './layoutMiniCity';
import {
  areBuildingsOverlapping,
  getBuildingSlotKey,
  getFarthestCornerDistance,
} from './layoutTestSupport';
import {
  MINI_CITY_BASE_SLOT_COUNT,
  MINI_CITY_MAX_SITE_COUNT,
} from './miniCitySlots';

const SEED = 20261013;
const CENTER = { x: 30, z: -18 };

const createSites = (count: number, prefix = 'site'): MiniCitySiteValue[] =>
  Array.from({ length: count }, (_, index) => ({ id: [prefix, String(index)].join('-'), isOwn: index % 2 === 0, side: 'supplier' }));

const layout = (sites: readonly MiniCitySiteValue[], cityId = 'city-a'): ReturnType<typeof layoutMiniCity> =>
  layoutMiniCity({ center: CENTER, cityId, seed: SEED, sites });

const getCompanySlots = (buildings: readonly NetworkSceneBuildingValue[]): Map<string, string> => new Map(
  buildings.filter(building => building.isCompany).map(building => [building.id, getBuildingSlotKey(building)]),
);

const expectNoOverlaps = (buildings: readonly NetworkSceneBuildingValue[]): void => {
  for (const [index, building] of buildings.entries()) {
    for (const other of buildings.slice(index + 1)) {
      expect(areBuildingsOverlapping(building, other)).toBe(false);
    }
  }
};

describe('layoutMiniCity', () => {
  it('keeps every building inside the radius of the city', () => {
    for (const count of [0, 1, 4, MINI_CITY_BASE_SLOT_COUNT]) {
      const { buildings, radius } = layout(createSites(count), ['city', String(count)].join('-'));

      expect(radius).toBe(MINI_CITY_RADIUS_METERS);
      expect(buildings.every(building => getFarthestCornerDistance(building, CENTER) <= radius + 1e-9)).toBe(true);
    }
  });

  it('does not overlap buildings', () => {
    for (const count of [0, 3, 9, 13]) {
      expectNoOverlaps(layout(createSites(count), ['city', String(count)].join('-')).buildings);
    }
  });

  it('keeps the centers of the company buildings at least the company spacing apart', () => {
    for (const count of [2, MINI_CITY_BASE_SLOT_COUNT, MINI_CITY_MAX_SITE_COUNT, 40]) {
      const companies = layout(createSites(count), ['city', String(count)].join('-')).buildings.filter(building => building.isCompany);

      expect(companies).toHaveLength(Math.min(count, MINI_CITY_MAX_SITE_COUNT));

      for (const [index, building] of companies.entries()) {
        for (const other of companies.slice(index + 1)) {
          expect(Math.hypot(building.x - other.x, building.z - other.z)).toBeGreaterThanOrEqual(COMPANY_MIN_SPACING_METERS - 1e-9);
        }
      }
    }
  });

  it('keeps houses and offices inside their size ranges and under the chip level', () => {
    const decor = [
      ...layout([], 'city-a').buildings,
      ...layout([], 'city-b').buildings,
      ...layout([], 'city-c').buildings,
      ...layout([], 'city-d').buildings,
    ].filter(building => !building.isCompany);

    expect(decor.length).toBeGreaterThan(0);

    for (const building of decor) {
      const range = building.kind === 'office' ? OFFICE_SIZE_RANGE_METERS : HOUSE_SIZE_RANGE_METERS;

      expect(building.height).toBeGreaterThanOrEqual(range.height[0]);
      expect(building.height).toBeLessThanOrEqual(range.height[1]);
      expect(building.height).toBeLessThanOrEqual(2);
    }
  });

  it('gives the same result for the same input', () => {
    expect(layout(createSites(5))).toEqual(layout(createSites(5)));
  });

  it('does not depend on the order of the sites', () => {
    const sites = createSites(7);

    expect(layout(sites.toReversed()).buildings.toSorted((current, prev) => current.id.localeCompare(prev.id)))
      .toEqual(layout(sites).buildings.toSorted((current, prev) => current.id.localeCompare(prev.id)));
  });

  it('places one company building per site with its own side and flag', () => {
    const sites = createSites(6);
    const companies = layout(sites).buildings.filter(building => building.isCompany);

    expect(companies.map(building => building.siteId).toSorted()).toEqual(sites.map(site => site.id).toSorted());

    for (const building of companies) {
      const site = sites.find(candidate => candidate.id === building.siteId);

      expect(building).toMatchObject({ isOwn: site?.isOwn, kind: 'warehouse', rank: 0, side: 'supplier' });
    }
  });

  it('keeps the slots of the existing sites when a new site comes into a free slot', () => {
    const before = createSites(5);
    const beforeSlots = getCompanySlots(layout(before).buildings);
    const occupied = new Set(beforeSlots.values());
    let added: MiniCitySiteValue | undefined;

    for (let index = 0; added === undefined && index < 200; index += 1) {
      const candidate: MiniCitySiteValue = { id: ['new-site', String(index)].join('-'), isOwn: false, side: 'customer' };
      const slot = getCompanySlots(layout([...before, candidate]).buildings).get(candidate.id);

      if (slot !== undefined && !occupied.has(slot)) {
        added = candidate;
      }
    }

    expect(added).toBeDefined();

    if (added !== undefined) {
      const afterSlots = getCompanySlots(layout([...before, added]).buildings);

      for (const [id, slot] of beforeSlots) {
        expect(afterSlots.get(id)).toBe(slot);
      }
    }
  });

  it('fills the base slots with distinct slots when the sites fill the city', () => {
    const sites = createSites(MINI_CITY_BASE_SLOT_COUNT);
    const slots = [...getCompanySlots(layout(sites).buildings).values()];

    expect(slots).toHaveLength(MINI_CITY_BASE_SLOT_COUNT);
    expect(new Set(slots).size).toBe(MINI_CITY_BASE_SLOT_COUNT);
  });

  it('keeps decor in the free base slots only, between the minimum and the maximum count', () => {
    const { buildings } = layout([]);
    const decor = buildings.filter(building => !building.isCompany);

    expect(decor.length).toBeGreaterThanOrEqual(1);
    expect(decor.length).toBeLessThanOrEqual(DECOR_MAX_COUNT);
    expect(decor.every(building => ['house', 'office'].includes(building.kind) && !building.isOwn)).toBe(true);
    expect(decor.every(building => building.rank >= 0 && building.rank < 1)).toBe(true);
    expect(decor.every(building => building.siteId === undefined && building.side === undefined)).toBe(true);
  });

  it('removes decor from the slots that companies take and keeps the rest of the decor still', () => {
    const empty = layout([]).buildings;
    const busy = layout(createSites(6)).buildings;
    const companySlots = new Set(busy.filter(building => building.isCompany).map(building => getBuildingSlotKey(building)));
    const survivors = busy.filter(building => !building.isCompany);

    for (const building of survivors) {
      expect(companySlots.has(getBuildingSlotKey(building))).toBe(false);
      expect(empty.find(candidate => candidate.id === building.id)).toEqual(building);
    }

    expect(survivors.length).toBeLessThanOrEqual(empty.length);
  });

  it('varies decor by city and seed', () => {
    const first = layout([], 'city-a').buildings.map(building => [building.kind, getBuildingSlotKey(building)].join(':'));
    const second = layout([], 'city-b').buildings.map(building => [building.kind, getBuildingSlotKey(building)].join(':'));
    const reseeded = layoutMiniCity({ center: CENTER, cityId: 'city-a', seed: SEED + 1, sites: [] }).buildings
      .map(building => [building.kind, getBuildingSlotKey(building)].join(':'));

    expect(second).not.toEqual(first);
    expect(reseeded).not.toEqual(first);
  });

  it('keeps every site when there are more sites than base slots and widens the city by one ring', () => {
    const sites = createSites(MINI_CITY_MAX_SITE_COUNT);
    const { buildings, hiddenSiteIds, radius } = layout(sites);
    const companies = buildings.filter(building => building.isCompany);

    expect(companies).toHaveLength(sites.length);
    expect(new Set(companies.map(building => building.siteId)).size).toBe(sites.length);
    expect(hiddenSiteIds).toEqual([]);
    expect(radius).toBe(MINI_CITY_OVERFLOW_RADIUS_METERS);
    expect(buildings.every(building => getFarthestCornerDistance(building, CENTER) <= radius + 1e-9)).toBe(true);
    expectNoOverlaps(buildings);
  });

  it('keeps the base radius while the sites fit the base slots', () => {
    expect(layout(createSites(MINI_CITY_BASE_SLOT_COUNT)).radius).toBe(MINI_CITY_RADIUS_METERS);
    expect(layout(createSites(MINI_CITY_BASE_SLOT_COUNT + 1)).radius).toBe(MINI_CITY_OVERFLOW_RADIUS_METERS);
  });

  it('gives the same overflow layout for any order of the sites that all fit', () => {
    const sites = createSites(MINI_CITY_BASE_SLOT_COUNT + 3);

    expect(getCompanySlots(layout(sites.toReversed()).buildings)).toEqual(getCompanySlots(layout(sites).buildings));
  });

  it('hides the sites over the limit, own first, and lists them in the order of the model', () => {
    const sites: MiniCitySiteValue[] = Array.from(
      { length: 30 },
      (_, index) => ({ id: ['site', String(index).padStart(2, '0')].join('-'), isOwn: index >= 25, side: 'supplier' }),
    );
    const { buildings, hiddenSiteIds, radius } = layout(sites);
    const companies = buildings.filter(building => building.isCompany);
    const visibleIds = companies.map(building => building.id);

    expect(companies).toHaveLength(MINI_CITY_MAX_SITE_COUNT);
    expect(hiddenSiteIds).toHaveLength(sites.length - MINI_CITY_MAX_SITE_COUNT);
    expect(radius).toBe(MINI_CITY_OVERFLOW_RADIUS_METERS);
    expect(sites.slice(25).every(site => visibleIds.includes(site.id))).toBe(true);
    expect(hiddenSiteIds).toEqual(sites.filter(site => !visibleIds.includes(site.id)).map(site => site.id));
    expect(new Set([...visibleIds, ...hiddenSiteIds]).size).toBe(sites.length);
    expectNoOverlaps(buildings);
  });

  it('hides nothing while the sites fit', () => {
    expect(layout(createSites(0)).hiddenSiteIds).toEqual([]);
    expect(layout(createSites(MINI_CITY_BASE_SLOT_COUNT)).hiddenSiteIds).toEqual([]);
  });
});
