import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapSiteValue } from '@/entities/network';

import { groupNetworkSites } from './groupNetworkSites';

const createSite = (id: string, isOwn: boolean): NetworkMapSiteValue => ({
  cityId: 'city',
  id,
  isOwn,
  label: id,
  nodeId: 'node',
  organizationName: 'Организация',
  side: 'customer',
});

describe('groupNetworkSites', () => {
  it('splits own sites from the network sites and keeps the order inside each group', () => {
    const sites = [createSite('a', true), createSite('b', false), createSite('c', true), createSite('d', false)];

    const groups = groupNetworkSites(sites);

    expect(groups.own.map(site => site.id)).toEqual(['a', 'c']);
    expect(groups.network.map(site => site.id)).toEqual(['b', 'd']);
  });

  it('gives two empty groups for no sites', () => {
    expect(groupNetworkSites([])).toEqual({ network: [], own: [] });
  });

  it('keeps one group empty when every site is own', () => {
    const groups = groupNetworkSites([createSite('a', true)]);

    expect(groups.network).toEqual([]);
    expect(groups.own).toHaveLength(1);
  });
});
