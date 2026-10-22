import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapSiteValue } from '@/entities/network';
import type { OrganizationSideValue } from '@/entities/organization';

import { listCitySides } from './listCitySides';

const createSite = (id: string, side: OrganizationSideValue): NetworkMapSiteValue => ({
  cityId: 'city',
  id,
  isOwn: false,
  label: id,
  nodeId: 'node',
  organizationId: 'organization',
  organizationName: 'Организация',
  side,
});

describe('listCitySides', () => {
  it('lists every side once in the fixed order whatever the site order is', () => {
    const sites = [
      createSite('a', 'carrier'),
      createSite('b', 'supplier'),
      createSite('c', 'supplier'),
      createSite('d', 'customer'),
    ];

    expect(listCitySides(sites)).toEqual(['customer', 'supplier', 'carrier']);
  });

  it('lists only the sides that are present', () => {
    expect(listCitySides([createSite('a', 'supplier')])).toEqual(['supplier']);
  });

  it('gives nothing for a city without sites', () => {
    expect(listCitySides([])).toEqual([]);
  });
});
