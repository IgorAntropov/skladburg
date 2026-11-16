import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import { placeIndustrialYard } from './placeIndustrialYard';

const CITY: NetworkSceneCityValue = {
  cityId: 'city',
  hiddenSiteIds: [],
  id: 'node',
  name: 'City',
  radius: 6.4,
  tier: 'small',
  x: 0,
  z: 0,
};

const buildSite = (id: string, changes: Partial<NetworkSceneBuildingValue> = {}): NetworkSceneBuildingValue => ({
  cityId: CITY.id,
  depth: 1.5,
  height: 1.5,
  id,
  isCompany: true,
  isOwn: false,
  kind: 'warehouse',
  rank: 0,
  rotation: 0,
  side: undefined,
  siteId: id,
  width: 2,
  x: 0,
  z: 0,
  ...changes,
});

describe('placeIndustrialYard', () => {
  it('chooses a single visible warehouse consistently when the input or owner changes', () => {
    const first = buildSite('first', { x: -3.2 });
    const second = buildSite('second', { isOwn: true, x: 3.2 });

    expect(placeIndustrialYard([second, first], [CITY])?.siteId).toBe('first');
    expect(placeIndustrialYard([{ ...first, isOwn: true }, second], [CITY])?.siteId).toBe('first');
  });

  it('aligns the yard with the rotated negative X gate', () => {
    const rotation = Math.PI / 2;
    const site = buildSite('site', { rotation, x: 3.2 });
    const yard = placeIndustrialYard([site], [CITY]);

    expect(yard?.rotation).toBe(rotation);
    expect(yard?.x).toBeCloseTo(site.x);
    expect(yard?.z).toBeGreaterThan(site.z + site.width / 2);
  });

  it('skips lots crossing city edges, buildings without sites and missing cities', () => {
    const away = buildSite('away', { x: -6 });
    const decor = buildSite('decor', { isCompany: false, siteId: undefined });
    const missing = buildSite('missing', { cityId: 'unknown' });

    expect(placeIndustrialYard([away, decor, missing], [CITY])).toBeUndefined();
    expect(placeIndustrialYard([away, buildSite('inside')], [CITY])?.siteId).toBe('inside');
  });
});
