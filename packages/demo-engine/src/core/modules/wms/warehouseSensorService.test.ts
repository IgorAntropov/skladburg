import { createClient } from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { WarehouseSensorService } from '@skladburg/contracts/wms/v1/warehouse_sensors';
import {
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const TENANT = SeedOrganizationId.CUSTOMER_1;
const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const OTHER_WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
const KAZAN_TOPOLOGY = { prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE };

it('allows a sensor-only grant and returns current readings without changing warehouse state', async () => {
  const harness = createModuleHarness();
  const client = createClient(WarehouseSensorService, harness.transport);
  const viewer = await addTestMember(harness, { organizationId: TENANT, permissions: ['sensor_view'], warehouseIds: [WAREHOUSE] });
  const options = callAs(viewer, TENANT);
  const location = createSeedWarehouseTopology(KAZAN_TOPOLOGY);
  await harness.runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(location));
  });
  const commitCount = harness.commits.length;
  const eventsCount = harness.events.length;
  const response = await client.getWarehouseSensors({ warehouseId: WAREHOUSE }, options);

  expect(response.devices).toHaveLength(1);
  const [device] = response.devices;
  expect(device?.zoneId).toBe(location.storageZones[0]?.id);
  expect(device?.channels.map(channel => channel.readings[0]?.value.case).toSorted()).toEqual([
    'co2Ppm', 'deciCelsius', 'doorOpen', 'relativeHumidityPercent',
  ]);
  expect(await client.getWarehouseSensors({ warehouseId: WAREHOUSE }, options)).toEqual(response);
  expect(harness.commits).toHaveLength(commitCount);
  expect(harness.events).toHaveLength(eventsCount);
});

it('requires sensor_view on the requested warehouse and conceals foreign warehouses', async () => {
  const harness = createModuleHarness();
  const client = createClient(WarehouseSensorService, harness.transport);
  const withWarehouseOnly = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['warehouse_view'], warehouseIds: [WAREHOUSE],
  });
  const withOtherScope = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['sensor_view'], warehouseIds: [OTHER_WAREHOUSE],
  });
  for (const caller of [withWarehouseOnly, withOtherScope]) {
    const error = await captureError(client.getWarehouseSensors({ warehouseId: WAREHOUSE }, callAs(caller, TENANT)));
    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  }
  const foreign = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
  const error = await captureError(client.getWarehouseSensors({ warehouseId: WAREHOUSE }, foreign));
  expect(readErrorDetail(error).code).toBe(ErrorCode.NOT_FOUND);
});

it('returns empty results for missing zones and rejects stored topology belonging to another tenant', async () => {
  const { runtime, transport } = createModuleHarness();
  const client = createClient(WarehouseSensorService, transport);
  const options = callAs(SeedUserId.ADMIN_1, TENANT);
  const request = { warehouseId: WAREHOUSE };
  expect((await client.getWarehouseSensors(request, options)).devices).toEqual([]);

  const replaced = createSeedWarehouseTopology({ ...KAZAN_TOPOLOGY, prefix: '8f000009' });
  await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(replaced));
  });
  expect((await client.getWarehouseSensors(request, options)).devices).toEqual([]);

  const foreign = createSeedWarehouseTopology({ ...KAZAN_TOPOLOGY, tenantId: SeedOrganizationId.SUPPLIER_1 });
  await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(foreign));
  });
  const error = await captureError(client.getWarehouseSensors(request, options));
  expect(readErrorDetail(error).code).toBe(ErrorCode.INTERNAL);
});
