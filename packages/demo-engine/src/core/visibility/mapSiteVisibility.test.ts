import { create } from '@bufbuild/protobuf';
import { MapSiteKind } from '@skladburg/contracts/network/v1/network';
import {
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../seed/index';
import { createEngineState } from '../state/index';
import {
  listVisibleMapSites,
  resolveMapSiteProfileKind,
} from './mapSiteVisibility';

const { read } = createEngineState(createSeedSnapshot());
const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('resolveMapSiteProfileKind', () => {
  it('prefers the supplier profile over the customer and the carrier ones', () => {
    const organization = create(OrganizationSchema, {
      profiles: [{ kind: ProfileKind.CARRIER }, { kind: ProfileKind.CUSTOMER }, { kind: ProfileKind.SUPPLIER }],
    });

    expect(resolveMapSiteProfileKind(organization)).toBe(ProfileKind.SUPPLIER);
  });

  it('falls back to the customer, then to the carrier', () => {
    const customer = create(OrganizationSchema, { profiles: [{ kind: ProfileKind.CARRIER }, { kind: ProfileKind.CUSTOMER }] });
    const carrier = create(OrganizationSchema, { profiles: [{ kind: ProfileKind.CARRIER }] });

    expect(resolveMapSiteProfileKind(customer)).toBe(ProfileKind.CUSTOMER);
    expect(resolveMapSiteProfileKind(carrier)).toBe(ProfileKind.CARRIER);
  });

  it('is unspecified for an organization without profiles', () => {
    expect(resolveMapSiteProfileKind(create(OrganizationSchema))).toBe(ProfileKind.UNSPECIFIED);
  });
});

describe('listVisibleMapSites', () => {
  it('lists the own warehouses with the name and the foreign verified ones without it', () => {
    const sites = listVisibleMapSites(read, SeedOrganizationId.CUSTOMER_1);
    const own = sites.filter(site => site.organizationId === SeedOrganizationId.CUSTOMER_1);
    const foreign = sites.filter(site => site.organizationId !== SeedOrganizationId.CUSTOMER_1);

    expect(sites).toHaveLength(9);
    expect(own.map(site => site.name)).not.toContain('');
    expect(foreign.map(site => site.name)).toEqual(Array.from({ length: 6 }, () => ''));
  });

  it('copies the placement and the owner name from the warehouse and the organization', () => {
    const [site] = listVisibleMapSites(read, SeedOrganizationId.CUSTOMER_1).filter(
      candidate => candidate.id === SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    );
    const warehouse = read.get('warehouses', SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1);

    expect(site).toMatchObject({
      cityId: warehouse?.cityId,
      kind: MapSiteKind.WAREHOUSE,
      mapNodeId: warehouse?.mapNodeId,
      organizationId: SeedOrganizationId.SUPPLIER_1,
      organizationName: 'Поставщик 1',
      profileKind: ProfileKind.SUPPLIER,
    });
  });

  it('carries the logo of the owner of a foreign verified site', () => {
    const site = listVisibleMapSites(read, SeedOrganizationId.CUSTOMER_1).find(
      candidate => candidate.id === SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    );

    expect(site?.organizationLogo?.lightUrl).toBe('logos/supplier-1-light.svg');
    expect(site?.organizationLogo?.darkUrl).toBe('logos/supplier-1-dark.svg');
  });

  it('carries the logo of an unverified owner on its own sites', () => {
    const [site] = listVisibleMapSites(read, SeedOrganizationId.SUPPLIER_5);

    expect(site?.organizationLogo?.lightUrl).toBe('logos/supplier-5-light.svg');
    expect(site?.organizationLogo?.darkUrl).toBe('logos/supplier-5-dark.svg');
  });

  it('gives every visible site the logo of its owner', () => {
    const sites = listVisibleMapSites(read, SeedOrganizationId.CUSTOMER_1);

    for (const site of sites) {
      expect(site.organizationLogo, site.organizationName).toEqual(read.get('organizations', site.organizationId)?.logo);
    }
  });

  it('shows no site, and so no logo, of an unverified owner to others', () => {
    const logos = listVisibleMapSites(read, SeedOrganizationId.CUSTOMER_1).map(site => site.organizationLogo?.lightUrl);

    expect(logos).not.toContain('logos/supplier-5-light.svg');
  });

  it('hides the sites of an unverified owner from everyone but the owner', () => {
    const foreign = listVisibleMapSites(read, SeedOrganizationId.CUSTOMER_1).map(site => site.id);
    const own = listVisibleMapSites(read, SeedOrganizationId.SUPPLIER_5);

    expect(foreign).not.toContain(SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1);
    expect(own.map(site => site.id)).toEqual([SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1]);
  });

  it('shows nothing to an unknown viewer', () => {
    expect(listVisibleMapSites(read, UNKNOWN_ID)).toEqual([]);
  });

  it('sorts the sites by the warehouse id', () => {
    const ids = listVisibleMapSites(read, SeedOrganizationId.CARRIER_1).map(site => site.id);

    expect(ids).toEqual([...ids].sort());
  });
});
