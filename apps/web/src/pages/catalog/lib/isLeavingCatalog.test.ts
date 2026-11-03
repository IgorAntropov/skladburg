import {
  describe,
  expect,
  it,
} from 'vitest';

import type { AppAddressValue } from '@/shared/routing';

import { isLeavingCatalog } from './isLeavingCatalog';

const LISTING_ID = 'b0000001-0000-4000-8000-000000000001';

describe('isLeavingCatalog', () => {
  it('keeps the catalog section and the listings of the catalog inside the catalog', () => {
    const catalog: AppAddressValue = { kind: 'section', section: 'catalog' };
    const listing: AppAddressValue = { kind: 'object', object: { id: LISTING_ID, type: 'listing' } };

    expect(isLeavingCatalog(catalog)).toBe(false);
    expect(isLeavingCatalog(listing)).toBe(false);
  });

  it('leaves the catalog for other sections, their objects, the home address and an unknown address', () => {
    const deals: AppAddressValue = { kind: 'section', section: 'deals' };
    const site: AppAddressValue = { kind: 'object', object: { id: LISTING_ID, type: 'site' } };
    const home: AppAddressValue = { kind: 'home' };

    expect(isLeavingCatalog(deals)).toBe(true);
    expect(isLeavingCatalog(site)).toBe(true);
    expect(isLeavingCatalog(home)).toBe(true);
    expect(isLeavingCatalog(undefined)).toBe(true);
  });
});
