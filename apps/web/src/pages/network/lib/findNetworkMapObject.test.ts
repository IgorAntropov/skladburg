import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkMapCityValue,
  NetworkMapModelValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { findNetworkMapObject } from './findNetworkMapObject';

const createCity = (id: string, siteIds: readonly string[]): NetworkMapCityValue => ({
  cityId: `${id}-city`,
  id,
  name: id,
  position: { column: 0, row: 0 },
  siteIds,
  timeZone: 'Europe/Moscow',
});

const createSite = (id: string, nodeId: string): NetworkMapSiteValue => ({
  cityId: `${nodeId}-city`,
  id,
  isOwn: false,
  label: id,
  nodeId,
  organizationName: 'Организация',
  side: 'supplier',
});

const model: NetworkMapModelValue = {
  cities: [createCity('node-a', ['site-2', 'site-1']), createCity('node-b', ['site-3']), createCity('node-c', [])],
  roads: [],
  sites: [createSite('site-2', 'node-a'), createSite('site-3', 'node-b'), createSite('site-1', 'node-a')],
};

describe('findNetworkMapObject', () => {
  it('finds a site together with its city', () => {
    const found = findNetworkMapObject(model, { id: 'site-3', type: 'site' });

    expect(found).toEqual({ city: model.cities[1], kind: 'site', site: model.sites[1] });
  });

  it('finds a city with its sites in the model order', () => {
    const found = findNetworkMapObject(model, { id: 'node-a', type: 'city' });

    expect(found?.kind).toBe('city');
    expect(found?.kind === 'city' ? found.sites.map(site => site.id) : []).toEqual(['site-2', 'site-1']);
  });

  it('finds a city without sites', () => {
    expect(findNetworkMapObject(model, { id: 'node-c', type: 'city' })).toEqual({
      city: model.cities[2],
      kind: 'city',
      sites: [],
    });
  });

  it('returns nothing for an unknown id', () => {
    expect(findNetworkMapObject(model, { id: 'missing', type: 'site' })).toBeUndefined();
    expect(findNetworkMapObject(model, { id: 'missing', type: 'city' })).toBeUndefined();
  });

  it('does not take a site id for a city id and the other way round', () => {
    expect(findNetworkMapObject(model, { id: 'site-1', type: 'city' })).toBeUndefined();
    expect(findNetworkMapObject(model, { id: 'node-a', type: 'site' })).toBeUndefined();
  });

  it('returns nothing for a site whose city is not in the model', () => {
    const orphanModel: NetworkMapModelValue = { ...model, cities: [] };

    expect(findNetworkMapObject(orphanModel, { id: 'site-1', type: 'site' })).toBeUndefined();
  });

  it('returns nothing for other object types and for no focus', () => {
    expect(findNetworkMapObject(model, { id: 'site-1', type: 'deal' })).toBeUndefined();
    expect(findNetworkMapObject(model, { id: 'node-a', type: 'warehouse' })).toBeUndefined();
    expect(findNetworkMapObject(model, undefined)).toBeUndefined();
  });
});
