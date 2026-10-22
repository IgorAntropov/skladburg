import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapSiteValue } from '@/entities/network';

import { resolveNetworkSelectedTarget } from './resolveNetworkSelectedTarget';

const createSite = (id: string, organizationId: string): NetworkMapSiteValue => ({
  cityId: 'city',
  id,
  isOwn: false,
  label: id,
  nodeId: 'node',
  organizationId,
  organizationName: 'Организация',
  side: 'supplier',
});

const SITES = [createSite('a', 'org-1'), createSite('b', 'org-2'), createSite('c', 'org-1')];

describe('resolveNetworkSelectedTarget', () => {
  it('gives a site and a city as map targets', () => {
    expect(resolveNetworkSelectedTarget('site-1', 'site', SITES)).toEqual({ id: 'site-1', kind: 'site' });
    expect(resolveNetworkSelectedTarget('city-1', 'city', SITES)).toEqual({ id: 'city-1', kind: 'city' });
  });

  it('gives all organization sites as one selection', () => {
    expect(resolveNetworkSelectedTarget('org-1', 'organization', SITES)).toEqual({
      id: 'org-1',
      kind: 'sites',
      siteIds: ['a', 'c'],
    });
  });

  it('gives nothing for an organization without sites on the map', () => {
    expect(resolveNetworkSelectedTarget('org-3', 'organization', SITES)).toBeUndefined();
    expect(resolveNetworkSelectedTarget('org-1', 'organization', [])).toBeUndefined();
  });

  it('gives nothing for other objects and for an empty focus', () => {
    expect(resolveNetworkSelectedTarget('deal-1', 'deal', SITES)).toBeUndefined();
    expect(resolveNetworkSelectedTarget(undefined, undefined, SITES)).toBeUndefined();
  });
});
