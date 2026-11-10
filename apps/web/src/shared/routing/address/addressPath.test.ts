import {
  describe,
  expect,
  it,
} from 'vitest';

import type { AppAddressValue } from './addressTypes';

import { getPlacedAddressSection } from './addressSections';
import {
  APP_SECTIONS,
  OBJECT_TYPES,
} from './addressTypes';
import { formatAddressPath } from './formatAddressPath';
import { parseAddressPath } from './parseAddressPath';

const DEAL_ID = '00000000-0000-4000-8000-000000000001';

describe('formatAddressPath', () => {
  it('formats home as the root path', () => {
    expect(formatAddressPath({ kind: 'home' })).toBe('/');
  });

  it.each(APP_SECTIONS)('formats the %s section', (section) => {
    expect(formatAddressPath({ kind: 'section', section })).toBe(`/${section}`);
  });

  it.each([
    ['deal', '/deals/'],
    ['document', '/documents/'],
    ['dashboard', '/dashboards/'],
    ['handling_unit', '/handling-units/'],
    ['cell', '/cells/'],
    ['vehicle', '/vehicles/'],
    ['transport_request', '/transport-requests/'],
    ['trip', '/trips/'],
    ['warehouse', '/warehouses/'],
    ['site', '/sites/'],
    ['city', '/cities/'],
    ['organization', '/organizations/'],
    ['listing', '/listings/'],
  ] as const)('formats the %s object with a plural kebab-case segment', (type, prefix) => {
    expect(formatAddressPath({ kind: 'object', object: { id: DEAL_ID, type } })).toBe(`${prefix}${DEAL_ID}`);
  });
});

describe('parseAddressPath round trip', () => {
  it('restores home', () => {
    expect(parseAddressPath('/')).toEqual({ kind: 'home' });
  });

  it.each(APP_SECTIONS)('restores the %s section', (section) => {
    const address: AppAddressValue = { kind: 'section', section };

    expect(parseAddressPath(formatAddressPath(address))).toEqual(address);
  });

  it.each(OBJECT_TYPES)('restores the %s object', (type) => {
    const address: AppAddressValue = { kind: 'object', object: { id: DEAL_ID, type } };

    expect(parseAddressPath(formatAddressPath(address))).toEqual(address);
  });

  it.each(['network-overview', 'a', 'A9_b-c', 'x'.repeat(64)])('accepts the id %s', (id) => {
    const address: AppAddressValue = { kind: 'object', object: { id, type: 'dashboard' } };

    expect(parseAddressPath(formatAddressPath(address))).toEqual(address);
  });

  it('gives every object type a home section from the section list', () => {
    for (const type of OBJECT_TYPES) {
      expect(APP_SECTIONS).toContain(getPlacedAddressSection({ kind: 'object', object: { id: DEAL_ID, type } }));
    }
  });

  it('maps objects to their home sections', () => {
    const sections = Object.fromEntries(
      OBJECT_TYPES.map(type => [type, getPlacedAddressSection({ kind: 'object', object: { id: DEAL_ID, type } })]),
    );

    expect(sections).toEqual({
      cell: 'warehouse',
      city: 'network',
      dashboard: 'network',
      deal: 'deals',
      document: 'deals',
      handling_unit: 'warehouse',
      listing: 'catalog',
      organization: 'network',
      site: 'network',
      transport_request: 'transport',
      trip: 'transport',
      vehicle: 'network',
      warehouse: 'warehouse',
    });
  });
});

describe('parseAddressPath listing', () => {
  it('reads a listing path as a catalog object', () => {
    expect(parseAddressPath(`/listings/${DEAL_ID}`)).toEqual({ kind: 'object', object: { id: DEAL_ID, type: 'listing' } });
  });

  it('writes a listing object as a path in the plural segment', () => {
    expect(formatAddressPath({ kind: 'object', object: { id: DEAL_ID, type: 'listing' } })).toBe(`/listings/${DEAL_ID}`);
  });
});

describe('parseAddressPath trailing slash', () => {
  it('accepts a trailing slash on a section', () => {
    expect(parseAddressPath('/deals/')).toEqual({ kind: 'section', section: 'deals' });
  });

  it('accepts a trailing slash on an object', () => {
    expect(parseAddressPath(`/cells/${DEAL_ID}/`)).toEqual({ kind: 'object', object: { id: DEAL_ID, type: 'cell' } });
  });
});

describe('parseAddressPath rejects', () => {
  it.each([
    ['an empty path', ''],
    ['a path without the leading slash', 'deals'],
    ['an unknown section', '/nope'],
    ['an unknown object segment', `/pallets/${DEAL_ID}`],
    ['a singular object segment', `/deal/${DEAL_ID}`],
    ['an extra segment', `/deals/${DEAL_ID}/items`],
    ['an extra segment on a section', '/network/extra'],
    ['an empty id', '/deals//'],
    ['a double slash', '//'],
    ['a double trailing slash', `/deals/${DEAL_ID}//`],
    ['an id with a slash', '/deals/a/b'],
    ['an id with a percent sign', '/deals/a%20b'],
    ['an id with a space', '/deals/a b'],
    ['an id with cyrillic letters', '/deals/сделка'],
    ['an id longer than 64 characters', `/deals/${'x'.repeat(65)}`],
    ['an id starting with a dash', '/deals/-abc'],
    ['an id starting with an underscore', '/deals/_abc'],
    ['an id with a dot', '/deals/a.b'],
    ['an id with a query', '/deals/abc?as=customer'],
    ['an id with a newline', '/deals/abc\n'],
    ['an uppercase section', '/Deals'],
    ['an uppercase object segment', `/Deals/${DEAL_ID}`],
    ['an uppercase handling units segment', `/Handling-Units/${DEAL_ID}`],
    ['a singular listing segment', `/listing/${DEAL_ID}`],
    ['a section with a query', '/network?x=1'],
  ])('%s', (_, path) => {
    expect(parseAddressPath(path)).toBeUndefined();
  });
});
