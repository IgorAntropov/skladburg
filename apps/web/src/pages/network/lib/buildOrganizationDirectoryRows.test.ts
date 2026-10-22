import { create } from '@bufbuild/protobuf';
import {
  OrganizationProfileSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  type OrganizationShowcase,
  OrganizationShowcaseSchema,
} from '@skladburg/contracts/organization/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkMapCityValue,
  NetworkMapModelValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { buildOrganizationDirectoryRows } from './buildOrganizationDirectoryRows';

const createShowcase = (
  id: string,
  name: string,
  profiles: readonly [ProfileKind, number][],
  sphereIds: readonly string[] = [],
): OrganizationShowcase => create(OrganizationShowcaseSchema, {
  id,
  name,
  profiles: profiles.map(([kind, verificationLevel]) => create(OrganizationProfileSchema, { kind, verificationLevel })),
  sphereIds: [...sphereIds],
});

const createCity = (id: string, name: string): NetworkMapCityValue => ({
  cityId: `${id}-city`,
  id,
  name,
  position: { column: 0, row: 0 },
  siteIds: [],
  timeZone: 'Europe/Moscow',
});

const createSite = (id: string, nodeId: string, organizationId: string): NetworkMapSiteValue => ({
  cityId: `${nodeId}-city`,
  id,
  isOwn: false,
  label: id,
  nodeId,
  organizationId,
  organizationName: organizationId,
  side: 'supplier',
});

const model: NetworkMapModelValue = {
  cities: [createCity('node-a', 'Воронеж'), createCity('node-b', 'Ярославль'), createCity('node-c', 'Казань')],
  roads: [],
  sites: [
    createSite('site-1', 'node-b', 'org-1'),
    createSite('site-2', 'node-a', 'org-1'),
    createSite('site-3', 'node-a', 'org-1'),
    createSite('site-4', 'node-c', 'org-2'),
  ],
};

const SPHERE_NAMES = new Map([
  ['sphere-food', 'Продукты'],
  ['sphere-milk', 'Молочная продукция'],
]);

describe('buildOrganizationDirectoryRows', () => {
  it('keeps the order of the showcases and marks the own company', () => {
    const rows = buildOrganizationDirectoryRows({
      model,
      ownOrganizationId: 'org-2',
      showcases: [createShowcase('org-1', 'Первая', []), createShowcase('org-2', 'Вторая', [])],
      sphereNameById: SPHERE_NAMES,
    });

    expect(rows.map(row => [row.id, row.isOwn])).toEqual([['org-1', false], ['org-2', true]]);
  });

  it('marks nobody without an acting organization', () => {
    const rows = buildOrganizationDirectoryRows({
      model,
      ownOrganizationId: undefined,
      showcases: [createShowcase('org-1', 'Первая', [])],
      sphereNameById: SPHERE_NAMES,
    });

    expect(rows[0]?.isOwn).toBe(false);
  });

  it('orders the profiles as customer, supplier, carrier whatever the data order is', () => {
    const [row] = buildOrganizationDirectoryRows({
      model,
      ownOrganizationId: undefined,
      showcases: [createShowcase('org-1', 'Первая', [
        [ProfileKind.CARRIER, 0],
        [ProfileKind.SUPPLIER, 2],
        [ProfileKind.CUSTOMER, 1],
      ])],
      sphereNameById: SPHERE_NAMES,
    });

    expect(row?.profiles.map(profile => profile.kind)).toEqual([ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER]);
  });

  it('drops a profile of an unknown kind', () => {
    const [row] = buildOrganizationDirectoryRows({
      model,
      ownOrganizationId: undefined,
      showcases: [createShowcase('org-1', 'Первая', [[ProfileKind.UNSPECIFIED, 1], [ProfileKind.SUPPLIER, 1]])],
      sphereNameById: SPHERE_NAMES,
    });

    expect(row?.profiles.map(profile => profile.kind)).toEqual([ProfileKind.SUPPLIER]);
  });

  it('lists the cities of the sites once each in the order of the model', () => {
    const rows = buildOrganizationDirectoryRows({
      model,
      ownOrganizationId: undefined,
      showcases: [createShowcase('org-1', 'Первая', []), createShowcase('org-2', 'Вторая', []), createShowcase('org-3', 'Третья', [])],
      sphereNameById: SPHERE_NAMES,
    });

    expect(rows.map(row => row.cityNames)).toEqual([['Воронеж', 'Ярославль'], ['Казань'], []]);
  });

  it('names the spheres in alphabetical order and skips the unknown ones', () => {
    const [row] = buildOrganizationDirectoryRows({
      model,
      ownOrganizationId: undefined,
      showcases: [createShowcase('org-1', 'Первая', [], ['sphere-food', 'unknown', 'sphere-milk'])],
      sphereNameById: SPHERE_NAMES,
    });

    expect(row?.sphereNames).toEqual(['Молочная продукция', 'Продукты']);
  });
});
