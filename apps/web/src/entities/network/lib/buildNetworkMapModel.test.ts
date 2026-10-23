import { create } from '@bufbuild/protobuf';
import {
  type City,
  CitySchema,
  CityTier,
  type MapNode,
  MapNodeSchema,
  type MapSite,
  MapSiteSchema,
  type RouteLeg,
  RouteLegSchema,
} from '@skladburg/contracts/network/v1/network';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapSourceValue } from '../model/networkMapTypes';

import { buildNetworkMapModel } from './buildNetworkMapModel';

const OWN_ORGANIZATION_ID = 'org-own';
const OTHER_ORGANIZATION_ID = 'org-other';

const createCity = (id: string, name: string, tier = CityTier.UNSPECIFIED): City => create(CitySchema, {
  id,
  name,
  tier,
  timeZone: 'Europe/Moscow',
});

const createNode = (id: string, cityId: string, column = 0, row = 0): MapNode => create(MapNodeSchema, {
  cityId,
  id,
  position: { column, row },
});

const createLeg = (id: string, fromMapNodeId: string, toMapNodeId: string): RouteLeg => create(RouteLegSchema, {
  distanceKm: 100,
  driveMinutes: 80,
  fromMapNodeId,
  id,
  toMapNodeId,
});

interface SiteInitValue {
  id: string;
  mapNodeId: string;
  name?: string;
  organizationId?: string;
  organizationName?: string;
  profileKind?: ProfileKind;
}

const createSite = ({
  id,
  mapNodeId,
  name = '',
  organizationId = OTHER_ORGANIZATION_ID,
  organizationName = 'Чужая организация',
  profileKind = ProfileKind.SUPPLIER,
}: SiteInitValue): MapSite => create(MapSiteSchema, {
  cityId: 'ignored',
  id,
  mapNodeId,
  name,
  organizationId,
  organizationName,
  profileKind,
});

const createSource = (overrides: Partial<NetworkMapSourceValue> = {}): NetworkMapSourceValue => ({
  directory: {
    cities: [
      createCity('city-yar', 'Ярославль', CityTier.LARGE),
      createCity('city-vor', 'Воронеж', CityTier.SMALL),
      createCity('city-yel', 'Ёлкино'),
    ],
    mapNodes: [
      createNode('node-yar', 'city-yar', 3, 1),
      createNode('node-vor', 'city-vor', 1, 2),
      createNode('node-yel', 'city-yel', 5, 4),
    ],
    routeLegs: [
      createLeg('leg-b', 'node-yar', 'node-yel'),
      createLeg('leg-a', 'node-vor', 'node-yar'),
    ],
  },
  locale: 'ru',
  organizationId: OWN_ORGANIZATION_ID,
  sites: [],
  ...overrides,
});

describe('buildNetworkMapModel cities', () => {
  it('builds a city for every map node that has a city and uses the node id as the city id', () => {
    const { cities } = buildNetworkMapModel(createSource());

    expect(cities.map(city => city.id)).toEqual(['node-vor', 'node-yel', 'node-yar']);
    expect(cities[0]).toEqual({
      cityId: 'city-vor',
      id: 'node-vor',
      name: 'Воронеж',
      position: { column: 1, row: 2 },
      siteIds: [],
      tier: 'small',
      timeZone: 'Europe/Moscow',
    });
  });

  it('passes the tier through and treats an unspecified tier as medium', () => {
    const { cities } = buildNetworkMapModel(createSource());

    expect(cities.map(city => [city.id, city.tier])).toEqual([
      ['node-vor', 'small'],
      ['node-yel', 'medium'],
      ['node-yar', 'large'],
    ]);
  });

  it('sorts the cities by name in the locale order', () => {
    const { cities } = buildNetworkMapModel(createSource());

    expect(cities.map(city => city.name)).toEqual(['Воронеж', 'Ёлкино', 'Ярославль']);
  });

  it('skips a map node whose city is unknown', () => {
    const source = createSource();
    const { cities } = buildNetworkMapModel({
      ...source,
      directory: { ...source.directory, mapNodes: [...source.directory.mapNodes, createNode('node-lost', 'city-lost')] },
    });

    expect(cities.map(city => city.id)).not.toContain('node-lost');
    expect(cities).toHaveLength(3);
  });

  it('falls back to the grid origin for a node without a position', () => {
    const source = createSource();
    const { cities } = buildNetworkMapModel({
      ...source,
      directory: { ...source.directory, mapNodes: [create(MapNodeSchema, { cityId: 'city-vor', id: 'node-vor' })] },
    });

    expect(cities[0]?.position).toEqual({ column: 0, row: 0 });
  });
});

describe('buildNetworkMapModel roads', () => {
  it('keeps the roads with both ends known, sorted by id', () => {
    const { roads } = buildNetworkMapModel(createSource());

    expect(roads).toEqual([
      { distanceKm: 100, driveMinutes: 80, fromNodeId: 'node-vor', id: 'leg-a', toNodeId: 'node-yar' },
      { distanceKm: 100, driveMinutes: 80, fromNodeId: 'node-yar', id: 'leg-b', toNodeId: 'node-yel' },
    ]);
  });

  it('skips a road with an unknown end', () => {
    const source = createSource();
    const { roads } = buildNetworkMapModel({
      ...source,
      directory: {
        ...source.directory,
        routeLegs: [
          ...source.directory.routeLegs,
          createLeg('leg-c', 'node-vor', 'node-lost'),
          createLeg('leg-d', 'node-lost', 'node-yar'),
        ],
      },
    });

    expect(roads.map(road => road.id)).toEqual(['leg-a', 'leg-b']);
  });
});

describe('buildNetworkMapModel sites', () => {
  it('labels an own site by its name and a foreign site by its organization', () => {
    const { sites } = buildNetworkMapModel(createSource({
      sites: [
        createSite({
          id: 'site-own',
          mapNodeId: 'node-vor',
          name: 'Склад «Север»',
          organizationId: OWN_ORGANIZATION_ID,
          organizationName: 'Моя организация',
          profileKind: ProfileKind.CUSTOMER,
        }),
        createSite({ id: 'site-foreign', mapNodeId: 'node-yar', organizationName: 'Поставщик 2' }),
      ],
    }));

    expect(sites).toEqual([
      {
        cityId: 'city-vor',
        id: 'site-own',
        isOwn: true,
        label: 'Склад «Север»',
        nodeId: 'node-vor',
        organizationId: OWN_ORGANIZATION_ID,
        organizationName: 'Моя организация',
        side: 'customer',
      },
      {
        cityId: 'city-yar',
        id: 'site-foreign',
        isOwn: false,
        label: 'Поставщик 2',
        nodeId: 'node-yar',
        organizationId: OTHER_ORGANIZATION_ID,
        organizationName: 'Поставщик 2',
        side: 'supplier',
      },
    ]);
  });

  it('maps the profile kind to the side of the site', () => {
    const { sites } = buildNetworkMapModel(createSource({
      sites: [
        createSite({ id: 'a', mapNodeId: 'node-vor', profileKind: ProfileKind.CARRIER }),
        createSite({ id: 'b', mapNodeId: 'node-vor', profileKind: ProfileKind.CUSTOMER }),
        createSite({ id: 'c', mapNodeId: 'node-vor', profileKind: ProfileKind.SUPPLIER }),
      ],
    }));

    expect(sites.map(site => site.side).toSorted()).toEqual(['carrier', 'customer', 'supplier']);
  });

  it('skips a site with an unspecified side and a site on an unknown node', () => {
    const { cities, sites } = buildNetworkMapModel(createSource({
      sites: [
        createSite({ id: 'unspecified', mapNodeId: 'node-vor', profileKind: ProfileKind.UNSPECIFIED }),
        createSite({ id: 'lost', mapNodeId: 'node-lost' }),
        createSite({ id: 'kept', mapNodeId: 'node-vor' }),
      ],
    }));

    expect(sites.map(site => site.id)).toEqual(['kept']);
    expect(cities.flatMap(city => city.siteIds)).toEqual(['kept']);
  });

  it('treats every site as foreign without an acting organization', () => {
    const { sites } = buildNetworkMapModel(createSource({
      organizationId: undefined,
      sites: [createSite({ id: 'site', mapNodeId: 'node-vor', organizationId: OWN_ORGANIZATION_ID, organizationName: 'Моя организация' })],
    }));

    expect(sites[0]?.isOwn).toBe(false);
    expect(sites[0]?.label).toBe('Моя организация');
  });

  it('puts own sites first, then orders by the city name and by the label', () => {
    const { cities, sites } = buildNetworkMapModel(createSource({
      sites: [
        createSite({ id: 'foreign-yar-b', mapNodeId: 'node-yar', organizationName: 'Яр Б' }),
        createSite({ id: 'foreign-vor', mapNodeId: 'node-vor', organizationName: 'Вор' }),
        createSite({ id: 'own-yar', mapNodeId: 'node-yar', name: 'Ярославский склад', organizationId: OWN_ORGANIZATION_ID }),
        createSite({ id: 'foreign-yar-a', mapNodeId: 'node-yar', organizationName: 'Яр А' }),
        createSite({ id: 'own-vor-b', mapNodeId: 'node-vor', name: 'Б склад', organizationId: OWN_ORGANIZATION_ID }),
        createSite({ id: 'own-vor-a', mapNodeId: 'node-vor', name: 'А склад', organizationId: OWN_ORGANIZATION_ID }),
        createSite({ id: 'foreign-yel', mapNodeId: 'node-yel', organizationName: 'Ёлка' }),
      ],
    }));

    expect(sites.map(site => site.id)).toEqual([
      'own-vor-a',
      'own-vor-b',
      'own-yar',
      'foreign-vor',
      'foreign-yel',
      'foreign-yar-a',
      'foreign-yar-b',
    ]);
    expect(cities.find(city => city.id === 'node-yar')?.siteIds).toEqual(['own-yar', 'foreign-yar-a', 'foreign-yar-b']);
    expect(cities.find(city => city.id === 'node-vor')?.siteIds).toEqual(['own-vor-a', 'own-vor-b', 'foreign-vor']);
  });
});
