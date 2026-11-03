import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  SearchSourcesInputValue,
  SearchSourcesValue,
} from './resolveSearchSources';

import {
  hasSearchSources,
  resolveSearchSources,
} from './resolveSearchSources';

const NOTHING: SearchSourcesInputValue = {
  canViewCatalog: false,
  canViewMarketplace: false,
  canViewNetwork: false,
  canViewWarehouse: false,
  hasCustomerProfile: false,
  hasSupplierProfile: false,
  isCustomerVerified: false,
};

const NO_SOURCES: SearchSourcesValue = {
  cities: false,
  organizations: false,
  ownListings: false,
  showcaseListings: false,
  sites: 'none',
};

interface PersonaCaseValue {
  expected: SearchSourcesValue;
  input: SearchSourcesInputValue;
  name: string;
}

const PERSONA_CASES: readonly PersonaCaseValue[] = [
  {
    expected: { cities: true, organizations: true, ownListings: false, showcaseListings: true, sites: 'map' },
    input: {
      ...NOTHING,
      canViewMarketplace: true,
      canViewNetwork: true,
      canViewWarehouse: true,
      hasCustomerProfile: true,
      isCustomerVerified: true,
    },
    name: 'a customer director with a verified profile',
  },
  {
    expected: { cities: true, organizations: true, ownListings: false, showcaseListings: true, sites: 'map' },
    input: {
      ...NOTHING,
      canViewMarketplace: true,
      canViewNetwork: true,
      canViewWarehouse: true,
      hasCustomerProfile: true,
      isCustomerVerified: true,
    },
    name: 'a buyer of a verified customer',
  },
  {
    expected: { cities: true, organizations: true, ownListings: true, showcaseListings: false, sites: 'map' },
    input: {
      ...NOTHING,
      canViewCatalog: true,
      canViewNetwork: true,
      canViewWarehouse: true,
      hasSupplierProfile: true,
    },
    name: 'a sales manager of a supplier',
  },
  {
    expected: { cities: true, organizations: true, ownListings: false, showcaseListings: false, sites: 'map' },
    input: { ...NOTHING, canViewNetwork: true },
    name: 'a dispatcher of a carrier',
  },
  {
    expected: { cities: false, organizations: false, ownListings: false, showcaseListings: false, sites: 'warehouses' },
    input: { ...NOTHING, canViewWarehouse: true, hasCustomerProfile: true, hasSupplierProfile: true },
    name: 'a storekeeper without the network',
  },
  {
    expected: NO_SOURCES,
    input: { ...NOTHING, hasCustomerProfile: true, hasSupplierProfile: true, isCustomerVerified: true },
    name: 'an accountant',
  },
  {
    expected: { cities: true, organizations: true, ownListings: false, showcaseListings: false, sites: 'map' },
    input: {
      ...NOTHING,
      canViewMarketplace: true,
      canViewNetwork: true,
      hasCustomerProfile: true,
      isCustomerVerified: false,
    },
    name: 'a buyer of an unverified customer',
  },
];

describe('resolveSearchSources', () => {
  it.each(PERSONA_CASES)('resolves the sources of $name', ({ expected, input }) => {
    expect(resolveSearchSources(input)).toEqual(expected);
  });

  it('keeps the own catalog closed without the catalog permission even for a supplier', () => {
    const sources = resolveSearchSources({ ...NOTHING, canViewNetwork: true, hasSupplierProfile: true });

    expect(sources.ownListings).toBe(false);
  });

  it('keeps the own catalog closed without a supplier profile even with the catalog permission', () => {
    const sources = resolveSearchSources({ ...NOTHING, canViewCatalog: true, canViewNetwork: true });

    expect(sources.ownListings).toBe(false);
  });

  it('keeps the showcase closed without the marketplace permission', () => {
    const sources = resolveSearchSources({
      ...NOTHING,
      canViewNetwork: true,
      hasCustomerProfile: true,
      isCustomerVerified: true,
    });

    expect(sources.showcaseListings).toBe(false);
  });

  it('prefers the map sites over the own warehouses', () => {
    const sources = resolveSearchSources({ ...NOTHING, canViewNetwork: true, canViewWarehouse: true });

    expect(sources.sites).toBe('map');
  });
});

describe('hasSearchSources', () => {
  it('is false when no group is available', () => {
    expect(hasSearchSources(NO_SOURCES)).toBe(false);
  });

  it.each<Partial<SearchSourcesValue>>([
    { cities: true },
    { organizations: true },
    { ownListings: true },
    { showcaseListings: true },
    { sites: 'warehouses' },
    { sites: 'map' },
  ])('is true when %o is available', (override) => {
    expect(hasSearchSources({ ...NO_SOURCES, ...override })).toBe(true);
  });
});
