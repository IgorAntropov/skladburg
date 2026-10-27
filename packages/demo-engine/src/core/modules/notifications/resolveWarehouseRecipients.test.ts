import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IStateReader } from '../../state/index';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import {
  addTestMember,
  createModuleHarness,
} from '../testing/moduleHarness';
import { resolveWarehouseRecipients } from './resolveWarehouseRecipients';

const requireWarehouse = (reader: IStateReader, warehouseId: string): Warehouse => {
  const warehouse = reader.get('warehouses', warehouseId);

  if (warehouse === undefined) {
    throw new Error(`The warehouse ${warehouseId} is missing in the starting data`);
  }

  return warehouse;
};

describe('resolveWarehouseRecipients', () => {
  it('names the organization-wide director and the storekeeper whose area holds the warehouse', () => {
    const { state } = createModuleHarness();
    const warehouse = requireWarehouse(state.read, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);

    expect(resolveWarehouseRecipients(state.read, warehouse)).toEqual([SeedUserId.ADMIN_1, SeedUserId.STOREKEEPER_1]);
  });

  it('skips the storekeeper whose area is another warehouse of the same organization', () => {
    const { state } = createModuleHarness();
    const warehouse = requireWarehouse(state.read, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);

    expect(resolveWarehouseRecipients(state.read, warehouse)).toEqual([SeedUserId.ADMIN_1]);
  });

  it('never names the members of another organization', () => {
    const { state } = createModuleHarness();
    const warehouse = requireWarehouse(state.read, SeedWarehouseId.CUSTOMER_2_SITE_1);
    const recipients = resolveWarehouseRecipients(state.read, warehouse);

    expect(recipients).toEqual([SeedUserId.ADMIN_5, SeedUserId.STOREKEEPER_2]);
    expect(recipients).not.toContain(SeedUserId.ADMIN_1);
  });

  it('names a member whose role area lists the warehouse and skips one without the warehouse_view permission', async () => {
    const harness = createModuleHarness();
    const warehouse = requireWarehouse(harness.state.read, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3);
    const viewer = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['warehouse_view'],
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3],
    });
    const editorOnly = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['inventory_view'],
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3],
    });
    const recipients = resolveWarehouseRecipients(harness.state.read, warehouse);

    expect(recipients).toContain(viewer);
    expect(recipients).not.toContain(editorOnly);
  });

  it('does not let a role of another organization pointing at the warehouse make its member a recipient', async () => {
    const harness = createModuleHarness();
    const warehouse = requireWarehouse(harness.state.read, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3);
    const foreign = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_2,
      permissions: ['warehouse_view'],
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3],
    });

    expect(resolveWarehouseRecipients(harness.state.read, warehouse)).not.toContain(foreign);
  });

  it('lists every recipient once in a stable order', () => {
    const { state } = createModuleHarness();
    const warehouse = requireWarehouse(state.read, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);
    const recipients = resolveWarehouseRecipients(state.read, warehouse);

    expect(new Set(recipients).size).toBe(recipients.length);
    expect(recipients).toEqual([...recipients].sort());
    expect(resolveWarehouseRecipients(state.read, warehouse)).toEqual(recipients);
  });
});
