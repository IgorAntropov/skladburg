import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedRoleId,
  SeedWarehouseId,
} from '../seed/index';
import { createEngineState } from '../state/index';
import {
  listVisibleRoles,
  listVisibleWarehouses,
} from './tenantRecords';

const { read } = createEngineState(createSeedSnapshot());

describe('listVisibleWarehouses', () => {
  it('returns every warehouse of the tenant for an organization-wide scope', () => {
    const warehouses = listVisibleWarehouses(read, SeedOrganizationId.CUSTOMER_1, { isOrganizationWide: true, warehouseIds: [] });

    expect(warehouses.map(warehouse => warehouse.id).sort()).toEqual([
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2,
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
    ]);
  });

  it('returns only the warehouses of the scope', () => {
    const warehouses = listVisibleWarehouses(read, SeedOrganizationId.CUSTOMER_1, {
      isOrganizationWide: false,
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2],
    });

    expect(warehouses.map(warehouse => warehouse.id)).toEqual([SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2]);
  });

  it('never returns a warehouse of another tenant, even when the scope names it', () => {
    const warehouses = listVisibleWarehouses(read, SeedOrganizationId.CUSTOMER_1, {
      isOrganizationWide: false,
      warehouseIds: [SeedWarehouseId.CUSTOMER_2_SITE_1],
    });

    expect(warehouses).toEqual([]);
  });

  it('returns nothing for a tenant without warehouses', () => {
    expect(listVisibleWarehouses(read, SeedOrganizationId.CARRIER_1, { isOrganizationWide: true, warehouseIds: [] })).toEqual([]);
  });
});

describe('listVisibleRoles', () => {
  it('returns the roles of the tenant only', () => {
    const roles = listVisibleRoles(read, SeedOrganizationId.CUSTOMER_1);

    expect(roles.map(role => role.id).sort()).toEqual([SeedRoleId.ADMIN_CUSTOMER_1, SeedRoleId.STOREKEEPER_CUSTOMER_1].sort());
    expect(roles.every(role => role.tenantId === SeedOrganizationId.CUSTOMER_1)).toBe(true);
  });

  it('returns nothing for an unknown tenant', () => {
    expect(listVisibleRoles(read, 'ffffffff-ffff-4fff-8fff-ffffffffffff')).toEqual([]);
  });
});
