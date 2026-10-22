import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapSiteValue } from '@/entities/network';

import { resolveNetworkFocusRequest } from './resolveNetworkFocusRequest';

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

describe('resolveNetworkFocusRequest', () => {
  it('gives nothing without a command', () => {
    expect(resolveNetworkFocusRequest(undefined, SITES)).toBeUndefined();
  });

  it('keeps an object command as it is with the command sequence', () => {
    expect(resolveNetworkFocusRequest({ id: 'a', isOrganization: false, sequence: 4 }, SITES)).toEqual({
      id: 'a',
      sequence: 4,
      siteIds: undefined,
    });
  });

  it('expands an organization command into its sites', () => {
    expect(resolveNetworkFocusRequest({ id: 'org-1', isOrganization: true, sequence: 7 }, SITES)).toEqual({
      id: 'org-1',
      sequence: 7,
      siteIds: ['a', 'c'],
    });
  });

  it('gives nothing for an organization without sites on the map', () => {
    expect(resolveNetworkFocusRequest({ id: 'org-3', isOrganization: true, sequence: 1 }, SITES)).toBeUndefined();
  });
});
