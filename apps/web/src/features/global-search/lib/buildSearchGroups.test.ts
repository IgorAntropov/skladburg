import { create } from '@bufbuild/protobuf';
import {
  ListingSchema,
  OwnListingSchema,
  ProductSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  ShowcaseListingSchema,
  ShowcaseSupplierSchema,
} from '@skladburg/contracts/catalog/v1/showcase';
import {
  CitySchema,
  MapNodeSchema,
  type MapSite,
  MapSiteSchema,
} from '@skladburg/contracts/network/v1/network';
import {
  OrganizationProfileSchema,
  ProfileKind,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { OrganizationShowcaseSchema } from '@skladburg/contracts/organization/v1/showcase';
import { parseSearchQuery } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { NetworkDirectoryValue } from '@/entities/network';

import type { SearchGroupValue } from '../model/searchResultTypes';
import type {
  SearchSourceStatesValue,
  SearchSourceStateValue,
} from '../model/searchSourceTypes';
import type { SearchSourcesValue } from './resolveSearchSources';

import { buildSearchGroups } from './buildSearchGroups';

const OWN_ORGANIZATION_ID = 'org-own';
const OWN_ORGANIZATION_NAME = 'Свежий рынок';

const ALL_SOURCES: SearchSourcesValue = {
  cities: true,
  organizations: true,
  ownListings: true,
  showcaseListings: true,
  sites: 'map',
};

const NO_STATES: SearchSourceStatesValue = {
  directory: undefined,
  mapSites: undefined,
  organizations: undefined,
  ownListings: undefined,
  showcaseListings: undefined,
  warehouses: undefined,
};

const DIRECTORY: NetworkDirectoryValue = {
  cities: [
    create(CitySchema, { id: 'city-rostov', name: 'Ростов-на-Дону' }),
    create(CitySchema, { id: 'city-kazan', name: 'Казань' }),
  ],
  mapNodes: [
    create(MapNodeSchema, { cityId: 'city-rostov', id: 'node-rostov' }),
    create(MapNodeSchema, { cityId: 'city-kazan', id: 'node-kazan' }),
  ],
  routeLegs: [],
};

const ready = <TData>(data: TData): SearchSourceStateValue<TData> => ({
  data,
  error: null,
  isStale: false,
  retry: vi.fn(),
  status: 'ready',
});

const stale = <TData>(data: TData): SearchSourceStateValue<TData> => ({ ...ready(data), isStale: true });

const failed = <TData>(retry: () => void): SearchSourceStateValue<TData> => ({
  data: undefined,
  error: new Error('failed'),
  isStale: false,
  retry,
  status: 'error',
});

const loading = <TData>(): SearchSourceStateValue<TData> => ({
  data: undefined,
  error: null,
  isStale: false,
  retry: vi.fn(),
  status: 'loading',
});

interface BuildOptionsValue {
  organizationName?: string;
  query: string;
  sources?: SearchSourcesValue;
  states: Partial<SearchSourceStatesValue>;
}

const build = ({
  organizationName = OWN_ORGANIZATION_NAME,
  query,
  sources = ALL_SOURCES,
  states,
}: BuildOptionsValue): SearchGroupValue[] => buildSearchGroups({
  organizationId: OWN_ORGANIZATION_ID,
  organizationName,
  query: parseSearchQuery(query),
  sources,
  states: { ...NO_STATES, ...states },
});

const createSite = (
  id: string,
  organizationId: string,
  organizationName: string,
  cityId: string,
  name = '',
): MapSite => create(MapSiteSchema, {
  cityId,
  id,
  mapNodeId: `node-${cityId}`,
  name,
  organizationId,
  organizationName,
  profileKind: ProfileKind.SUPPLIER,
});

describe('buildSearchGroups', () => {
  it('keeps a constant group order whatever the order of the sources', () => {
    const groups = build({
      query: 'ростов',
      states: {
        directory: ready(DIRECTORY),
        mapSites: ready([createSite('site-1', 'org-other', 'Поле', 'city-rostov')]),
        organizations: ready([create(OrganizationShowcaseSchema, { id: 'org-1', name: 'Ростов Агро' })]),
        ownListings: ready({
          items: [create(OwnListingSchema, {
            listing: create(ListingSchema, { id: 'listing-1', isPublished: true }),
            product: create(ProductSchema, { id: 'product-1', name: 'Ростовский хлеб' }),
          })],
          nextPageToken: '',
        }),
        showcaseListings: ready({
          items: [create(ShowcaseListingSchema, { id: 'listing-2', productName: 'Ростовская мука' })],
          nextPageToken: '',
        }),
      },
    });

    expect(groups.map(group => group.id)).toEqual([
      'organizations',
      'sites',
      'cities',
      'own-listings',
      'showcase-listings',
    ]);
  });

  it('leaves out a group without results', () => {
    const groups = build({
      query: 'казань',
      states: {
        directory: ready(DIRECTORY),
        mapSites: ready([createSite('site-1', 'org-other', 'Поле', 'city-rostov')]),
        organizations: ready([create(OrganizationShowcaseSchema, { id: 'org-1', name: 'Ростов Агро' })]),
      },
    });

    expect(groups.map(group => group.id)).toEqual(['cities']);
  });

  it('finds a foreign site only by its city and names it after the company', () => {
    const groups = build({
      query: 'ростов',
      sources: { ...ALL_SOURCES, cities: false, organizations: false },
      states: {
        directory: ready(DIRECTORY),
        mapSites: ready([createSite('site-1', 'org-other', 'Голден Фрут', 'city-rostov', 'Склад на Садовой')]),
      },
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.options).toEqual([{
      address: { kind: 'object', object: { id: 'site-1', type: 'site' } },
      detail: { cityName: 'Ростов-на-Дону', isOwn: false, kind: 'site', organizationName: 'Голден Фрут' },
      detailMatches: [{ end: 6, start: 0 }],
      groupId: 'sites',
      objectId: 'site-1',
      title: 'Голден Фрут',
      titleMatches: [],
    }]);
  });

  it('does not find a foreign site by the company name', () => {
    const groups = build({
      query: 'голден',
      sources: { ...ALL_SOURCES, cities: false, organizations: false },
      states: {
        directory: ready(DIRECTORY),
        mapSites: ready([createSite('site-1', 'org-other', 'Голден Фрут', 'city-rostov')]),
      },
    });

    expect(groups).toEqual([]);
  });

  it('does not find a foreign site by the name even when the server sends one', () => {
    const groups = build({
      query: 'садовой',
      sources: { ...ALL_SOURCES, cities: false, organizations: false },
      states: {
        directory: ready(DIRECTORY),
        mapSites: ready([createSite('site-1', 'org-other', 'Голден Фрут', 'city-rostov', 'Склад на Садовой')]),
      },
    });

    expect(groups).toEqual([]);
  });

  it('finds an own site by its name and by its city and names it after the site', () => {
    const states = {
      directory: ready(DIRECTORY),
      mapSites: ready([createSite('site-1', OWN_ORGANIZATION_ID, OWN_ORGANIZATION_NAME, 'city-kazan', 'Холодный склад')]),
    };
    const sources = { ...ALL_SOURCES, cities: false, organizations: false };

    const [byName] = build({ query: 'холод', sources, states });
    const [byCity] = build({ query: 'казань', sources, states });
    const [byBoth] = build({ query: 'склад казан', sources, states });

    expect(byName?.options[0]).toMatchObject({
      detail: { cityName: 'Казань', isOwn: true, organizationName: OWN_ORGANIZATION_NAME },
      detailMatches: [],
      title: 'Холодный склад',
      titleMatches: [{ end: 5, start: 0 }],
    });
    expect(byCity?.options[0]).toMatchObject({
      detailMatches: [{ end: 6, start: 0 }],
      title: 'Холодный склад',
      titleMatches: [],
    });
    expect(byBoth?.options).toHaveLength(1);
  });

  it('treats an own site without a name as a company site found only by its city', () => {
    const states = {
      directory: ready(DIRECTORY),
      mapSites: ready([createSite('site-1', OWN_ORGANIZATION_ID, OWN_ORGANIZATION_NAME, 'city-kazan')]),
    };
    const sources = { ...ALL_SOURCES, cities: false, organizations: false };

    expect(build({ query: 'свежий', sources, states })).toEqual([]);
    expect(build({ query: 'казань', sources, states })[0]?.options[0]).toMatchObject({
      detail: { isOwn: true },
      title: OWN_ORGANIZATION_NAME,
      titleMatches: [],
    });
  });

  it('skips a site whose city is unknown', () => {
    const groups = build({
      query: 'склад',
      sources: { ...ALL_SOURCES, cities: false, organizations: false },
      states: {
        directory: ready(DIRECTORY),
        mapSites: ready([createSite('site-1', OWN_ORGANIZATION_ID, OWN_ORGANIZATION_NAME, 'city-missing', 'Склад')]),
      },
    });

    expect(groups).toEqual([]);
  });

  it('finds the own warehouses of a storekeeper by name and city and opens them as warehouses', () => {
    const states = {
      directory: ready(DIRECTORY),
      warehouses: ready([
        create(WarehouseSchema, { cityId: 'city-rostov', id: 'warehouse-1', name: 'Главный склад' }),
        create(WarehouseSchema, { cityId: 'city-kazan', id: 'warehouse-2', name: 'Холодильник' }),
      ]),
    };
    const sources: SearchSourcesValue = { ...ALL_SOURCES, cities: false, organizations: false, sites: 'warehouses' };

    const [byName] = build({ query: 'главный', sources, states });
    const [byCity] = build({ query: 'казань', sources, states });

    expect(byName?.options).toEqual([{
      address: { kind: 'object', object: { id: 'warehouse-1', type: 'warehouse' } },
      detail: { cityName: 'Ростов-на-Дону', isOwn: true, kind: 'site', organizationName: OWN_ORGANIZATION_NAME },
      detailMatches: [],
      groupId: 'sites',
      objectId: 'warehouse-1',
      title: 'Главный склад',
      titleMatches: [{ end: 7, start: 0 }],
    }]);
    expect(byCity?.options.map(option => option.objectId)).toEqual(['warehouse-2']);
  });

  it('opens a city by its map node and finds it without the letter yo', () => {
    const groups = build({
      query: 'казан',
      sources: { ...ALL_SOURCES, organizations: false, sites: 'none' },
      states: { directory: ready(DIRECTORY) },
    });

    expect(groups[0]?.options).toEqual([{
      address: { kind: 'object', object: { id: 'node-kazan', type: 'city' } },
      detail: { kind: 'city' },
      detailMatches: [],
      groupId: 'cities',
      objectId: 'node-kazan',
      title: 'Казань',
      titleMatches: [{ end: 5, start: 0 }],
    }]);
  });

  it('lists the sides of a company once each and skips an unknown profile', () => {
    const groups = build({
      query: 'тёплый',
      sources: { ...ALL_SOURCES, cities: false, sites: 'none' },
      states: {
        organizations: ready([
          create(OrganizationShowcaseSchema, {
            id: 'org-1',
            name: 'Теплый угол',
            profiles: [
              create(OrganizationProfileSchema, { kind: ProfileKind.SUPPLIER }),
              create(OrganizationProfileSchema, { kind: ProfileKind.SUPPLIER }),
              create(OrganizationProfileSchema, { kind: ProfileKind.CARRIER }),
              create(OrganizationProfileSchema, { kind: ProfileKind.UNSPECIFIED }),
            ],
          }),
        ]),
      },
    });

    expect(groups[0]?.options[0]).toMatchObject({
      address: { kind: 'object', object: { id: 'org-1', type: 'organization' } },
      detail: { kind: 'organization', sides: ['supplier', 'carrier'] },
      titleMatches: [{ end: 6, start: 0 }],
    });
  });

  it('puts a GTIN match of an own listing first and marks its publication', () => {
    const groups = build({
      query: '04607001234567',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, showcaseListings: false, sites: 'none' },
      states: {
        ownListings: ready({
          items: [
            create(OwnListingSchema, {
              listing: create(ListingSchema, { id: 'listing-1', isPublished: false }),
              product: create(ProductSchema, { gtin: '4600000000000', name: '4607001234567' }),
            }),
            create(OwnListingSchema, {
              listing: create(ListingSchema, { id: 'listing-2', isPublished: true }),
              product: create(ProductSchema, { gtin: '4607001234567', name: 'Яблоки' }),
            }),
          ],
          nextPageToken: '',
        }),
      },
    });

    expect(groups[0]?.options.map(option => option.objectId)).toEqual(['listing-2', 'listing-1']);
    expect(groups[0]?.options[0]?.detail).toEqual({ isPublished: true, kind: 'own-listing' });
  });

  it('highlights the supplier of a showcase listing in the second line', () => {
    const groups = build({
      query: 'голден',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, sites: 'none' },
      states: {
        showcaseListings: ready({
          items: [
            create(ShowcaseListingSchema, {
              id: 'listing-1',
              productName: 'Яблоки',
              supplier: create(ShowcaseSupplierSchema, { name: 'Голден Фрут' }),
            }),
            create(ShowcaseListingSchema, {
              id: 'listing-2',
              productName: 'Яблоки Голден',
              supplier: create(ShowcaseSupplierSchema, { name: 'Сад' }),
            }),
          ],
          nextPageToken: '',
        }),
      },
    });

    expect(groups[0]?.options).toMatchObject([
      {
        address: { kind: 'object', object: { id: 'listing-2', type: 'listing' } },
        detail: { kind: 'showcase-listing', supplierName: 'Сад' },
        detailMatches: [],
        titleMatches: [{ end: 13, start: 7 }],
      },
      {
        detail: { kind: 'showcase-listing', supplierName: 'Голден Фрут' },
        detailMatches: [{ end: 6, start: 0 }],
        titleMatches: [],
      },
    ]);
  });

  it('keeps five options and says there are more', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => create(ShowcaseListingSchema, {
      id: `listing-${id}`,
      productName: `Яблоки ${id}`,
    }));

    const groups = build({
      query: 'яблоки',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, sites: 'none' },
      states: { showcaseListings: ready({ items, nextPageToken: '' }) },
    });

    expect(groups[0]?.options).toHaveLength(5);
    expect(groups[0]?.hasMore).toBe(true);
  });

  it('says there are more when the server has a next page', () => {
    const groups = build({
      query: 'яблоки',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, sites: 'none' },
      states: {
        showcaseListings: ready({
          items: [create(ShowcaseListingSchema, { id: 'listing-1', productName: 'Яблоки' })],
          nextPageToken: 'next',
        }),
      },
    });

    expect(groups[0]?.options).toHaveLength(1);
    expect(groups[0]?.hasMore).toBe(true);
  });

  it('marks a group as stale while the rows of the previous query are shown', () => {
    const groups = build({
      query: 'яблоки',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, sites: 'none' },
      states: {
        showcaseListings: stale({
          items: [create(ShowcaseListingSchema, { id: 'listing-1', productName: 'Яблоки' })],
          nextPageToken: '',
        }),
      },
    });

    expect(groups).toMatchObject([{ id: 'showcase-listings', isStale: true, status: 'ready' }]);
    expect(groups[0]?.options).toHaveLength(1);
  });

  it('drops the stale rows that the new query no longer matches and keeps the matching ones', () => {
    const groups = build({
      query: 'яблоки груша',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, sites: 'none' },
      states: {
        ownListings: stale({
          items: [
            create(OwnListingSchema, {
              listing: create(ListingSchema, { id: 'own-apples' }),
              product: create(ProductSchema, { name: 'Яблоки Голден' }),
            }),
            create(OwnListingSchema, {
              listing: create(ListingSchema, { id: 'own-pear' }),
              product: create(ProductSchema, { name: 'Груша Конференция', sku: 'ЯБЛОКИ-ГРУША-1' }),
            }),
          ],
          nextPageToken: '',
        }),
        showcaseListings: stale({
          items: [
            create(ShowcaseListingSchema, { id: 'showcase-apples', productName: 'Яблоки Голден' }),
            create(ShowcaseListingSchema, {
              id: 'showcase-pear',
              productName: 'Груша',
              supplier: create(ShowcaseSupplierSchema, { name: 'Яблоки и сад' }),
            }),
          ],
          nextPageToken: '',
        }),
      },
    });

    expect(groups.map(group => group.options.map(option => option.objectId))).toEqual([['own-pear'], ['showcase-pear']]);
  });

  it('keeps the fresh rows of the server as they came', () => {
    const groups = build({
      query: 'яблоки груша',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, sites: 'none' },
      states: {
        showcaseListings: ready({
          items: [create(ShowcaseListingSchema, { id: 'showcase-apples', productName: 'Яблоки Голден' })],
          nextPageToken: '',
        }),
      },
    });

    expect(groups[0]?.options.map(option => option.objectId)).toEqual(['showcase-apples']);
  });

  it('shows a loading group instead of an empty stale one so that nothing looks settled', () => {
    const groups = build({
      query: 'яблоки',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, sites: 'none' },
      states: { showcaseListings: stale({ items: [], nextPageToken: '' }) },
    });

    expect(groups).toMatchObject([{ id: 'showcase-listings', isStale: false, options: [], status: 'loading' }]);
  });

  it('keeps a group fresh when its local source is fresh', () => {
    const groups = build({
      query: 'яблоки',
      sources: { ...ALL_SOURCES, cities: false, showcaseListings: false, sites: 'none' },
      states: {
        organizations: ready([create(OrganizationShowcaseSchema, { id: 'org-1', name: 'Яблоки и груши' })]),
      },
    });

    expect(groups).toMatchObject([{ id: 'organizations', isStale: false, status: 'ready' }]);
  });

  it('shows an empty loading group while a source answers', () => {
    const groups = build({
      query: 'яблоки',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, sites: 'none' },
      states: { showcaseListings: loading() },
    });

    expect(groups).toMatchObject([{ error: null, id: 'showcase-listings', options: [], status: 'loading' }]);
  });

  it('turns a failed source into an error group with a retry and keeps the others', () => {
    const retryShowcase = vi.fn();

    const groups = build({
      query: 'казань',
      sources: { ...ALL_SOURCES, organizations: false, ownListings: false, sites: 'none' },
      states: {
        directory: ready(DIRECTORY),
        showcaseListings: failed(retryShowcase),
      },
    });

    expect(groups.map(group => [group.id, group.status])).toEqual([
      ['cities', 'ready'],
      ['showcase-listings', 'error'],
    ]);

    groups[1]?.retry();

    expect(retryShowcase).toHaveBeenCalledTimes(1);
    expect(groups[1]?.error).toBeInstanceOf(Error);
  });

  it('shows the sites group as failed when the city directory failed and retries only the failed source', () => {
    const retryDirectory = vi.fn();
    const mapSites = ready([createSite('site-1', 'org-other', 'Поле', 'city-rostov')]);

    const groups = build({
      query: 'ростов',
      sources: { ...ALL_SOURCES, organizations: false },
      states: { directory: failed(retryDirectory), mapSites },
    });

    expect(groups.map(group => [group.id, group.status])).toEqual([
      ['sites', 'error'],
      ['cities', 'error'],
    ]);

    groups[0]?.retry();

    expect(retryDirectory).toHaveBeenCalledTimes(1);
    expect(mapSites.retry).not.toHaveBeenCalled();
  });

  it('builds nothing for a source that is not available', () => {
    const groups = build({
      query: 'ростов',
      sources: { ...ALL_SOURCES, cities: false, organizations: false, ownListings: false, showcaseListings: false, sites: 'none' },
      states: {
        directory: ready(DIRECTORY),
        organizations: ready([create(OrganizationShowcaseSchema, { id: 'org-1', name: 'Ростов Агро' })]),
      },
    });

    expect(groups).toEqual([]);
  });
});
