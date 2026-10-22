import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapSiteValue } from '@/entities/network';

import { listOrganizationSiteIds } from './listOrganizationSiteIds';

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

describe('listOrganizationSiteIds', () => {
  const sites = [createSite('a', 'org-1'), createSite('b', 'org-2'), createSite('c', 'org-1')];

  it('lists the organization sites in the model order', () => {
    expect(listOrganizationSiteIds(sites, 'org-1')).toEqual(['a', 'c']);
  });

  it('gives one shared empty list for no organization and for no sites', () => {
    const withoutOrganization = listOrganizationSiteIds(sites, undefined);
    const withoutSites = listOrganizationSiteIds(sites, 'org-3');

    expect(withoutOrganization).toEqual([]);
    expect(withoutSites).toBe(withoutOrganization);
    expect(listOrganizationSiteIds([], 'org-1')).toBe(withoutOrganization);
  });
});
