import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { YardQueuePolicyService } from '@skladburg/contracts/wms/v1/yard_queue_policy';
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
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import {
  readInboundTask,
  saveInboundTask,
} from './inboundRecords';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const TENANT = SeedOrganizationId.CUSTOMER_1;
const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const owner = callAs(SeedUserId.ADMIN_1, TENANT);
const supplier = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
const ZERO_WEIGHTS = {
  cargoUrgencyWeight: 0,
  deliveryWindowWeight: 0,
  explicitUrgencyWeight: 0,
  resourceAvailabilityWeight: 0,
  waitingTimeWeight: 0,
};

it('reads default weights, saves only the active organization and publishes one thin change', async () => {
  const { events, runtime, transport } = createModuleHarness();
  const client = createClient(YardQueuePolicyService, transport);
  const original = await client.getYardQueuePolicy({}, owner);
  expect(original.policy).toMatchObject({
    organizationId: TENANT,
    version: 0n,
    weights: { cargoUrgencyWeight: 55, deliveryWindowWeight: 25, explicitUrgencyWeight: 100,
      resourceAvailabilityWeight: 5, waitingTimeWeight: 10 },
  });
  const request = { expectedVersion: 0n, idempotencyKey: nextUuid(), weights: ZERO_WEIGHTS };
  const saved = await client.saveYardQueuePolicy(request, owner);
  expect(saved.policy).toMatchObject({ organizationId: TENANT, version: 1n, weights: ZERO_WEIGHTS });
  expect(await client.saveYardQueuePolicy(request, owner)).toEqual(saved);
  expect(await client.saveYardQueuePolicy({ ...request, expectedVersion: 1n, idempotencyKey: nextUuid() }, owner)).toEqual(saved);
  const stale = await captureError(client.saveYardQueuePolicy({ ...request, idempotencyKey: nextUuid() }, owner));
  expect(readErrorDetail(stale).code).toBe(ErrorCode.VERSION_CONFLICT);
  expect(runtime.read.get('yardQueuePolicies', TENANT)).toEqual(saved.policy);
  expect(await client.getYardQueuePolicy({}, owner)).toEqual({ ...original, policy: saved.policy });
  const another = await client.getYardQueuePolicy({}, supplier);
  expect(another.policy).toMatchObject({ organizationId: SeedOrganizationId.SUPPLIER_1, version: 0n, weights: original.policy?.weights });
  expect(events.map(({ channel, payload }) => ({ channel, payload }))).toMatchObject([{
    channel: organizationChannel(TENANT), payload: { case: 'yardQueuePolicyChanged', value: { organizationId: TENANT } },
  }]);
});

it('requires organization-wide permissions, a version and every bounded weight', async () => {
  const harness = createModuleHarness();
  const { runtime, transport } = harness;
  const client = createClient(YardQueuePolicyService, transport);
  const scoped = callAs(await addTestMember(harness, {
    organizationId: TENANT, permissions: ['yard_view', 'yard_manage'], warehouseIds: [WAREHOUSE],
  }), TENANT);
  const observer = callAs(await addTestMember(harness, {
    organizationId: TENANT, permissions: ['yard_view'], warehouseIds: [],
  }), TENANT);
  const request = { expectedVersion: 0n, idempotencyKey: nextUuid(), weights: ZERO_WEIGHTS };
  const denied = await captureError(client.getYardQueuePolicy({}, scoped));
  expect(readErrorDetail(denied).code).toBe(ErrorCode.PERMISSION_DENIED);
  for (const caller of [scoped, observer]) {
    const deniedWrite = await captureError(client.saveYardQueuePolicy(request, caller));
    expect(readErrorDetail(deniedWrite).code).toBe(ErrorCode.PERMISSION_DENIED);
  }
  await expect(client.getYardQueuePolicy({}, observer)).resolves.toMatchObject({ policy: { version: 0n } });
  for (const invalid of [
    { ...request, expectedVersion: undefined },
    { ...request, weights: { ...ZERO_WEIGHTS, waitingTimeWeight: undefined } },
    { ...request, weights: { ...ZERO_WEIGHTS, waitingTimeWeight: 101 } },
  ]) {
    const invalidWrite = await captureError(client.saveYardQueuePolicy(invalid, owner));
    expect(readErrorDetail(invalidWrite).code).toBe(ErrorCode.VALIDATION_FAILED);
  }
  expect(runtime.read.get('yardQueuePolicies', TENANT)).toBeUndefined();
});

it('applies the saved order to both owned wards atomically while a foreign yard and a booked slot remain intact', async () => {
  const { commits, events, runtime, transport } = createModuleHarness();
  const client = createClient(YardQueuePolicyService, transport);
  const foreign = SeedOrganizationId.SUPPLIER_1;
  const wards = [
    { prefix: '8f000001', tenantId: TENANT, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2 },
    { prefix: '8f000002', tenantId: TENANT, warehouseId: WAREHOUSE },
    { prefix: '8f000003', tenantId: foreign, warehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1 },
  ];
  const receiving = await runtime.command(transaction => wards.map((ward) => {
    const topology = createSeedWarehouseTopology(ward);
    const area = topology.receivingArea;
    const dock = area?.unloadingPoint;
    if (area === undefined || dock === undefined) {
      throw new Error('Missing warehouse dock');
    }
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const [early, urgent, booked] = [0, 1, 2].map((index) => {
      const id = nextUuid();
      const at = timestampFromMs(transaction.worldTimeMs - (3 - index) * 600_000);
      transaction.put('deals', create(DealSchema, {
        customerOrganizationId: ward.tenantId,
        id,
        isUrgent: index === 1,
        shipToWarehouseId: ward.warehouseId,
        status: DealStatus.ARRIVED,
        transitions: [{ at, to: DealStatus.ARRIVED }],
      }));
      const startsAt = timestampFromMs(transaction.worldTimeMs + 1_800_000);
      const task = create(ReceivingTaskSchema, {
        dealId: id,
        dockSchedule: index === 2
          ? {
              preferredStartsAt: startsAt,
              reservation: { endsAt: timestampFromMs(transaction.worldTimeMs + 3_600_000), startsAt, unloadingPointId: dock.id },
            }
          : undefined,
        expectedUnits: [{ id: nextUuid() }],
        id,
        orderLines: [{ dealLineId: nextUuid() }],
        receivingAreaId: area.id,
        status: ReceivingTaskStatus.OPEN,
        version: 1,
        warehouseId: ward.warehouseId,
        yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK,
      });
      saveInboundTask(transaction, runtime, task, ward.tenantId);
      return task;
    });
    if (early === undefined || urgent === undefined || booked === undefined) {
      throw new Error('Missing waiting visits');
    }
    return { booked, dock, early, urgent, ward };
  }));
  const readTask = (id: string): ReturnType<typeof readInboundTask> => {
    const record = runtime.read.get('warehouseInbound', id);
    if (record === undefined) {
      throw new Error('Missing receiving task');
    }
    return readInboundTask(record, runtime.errors);
  };
  const fromEvent = events.length;
  await client.saveYardQueuePolicy({ expectedVersion: 0n, idempotencyKey: nextUuid(), weights: ZERO_WEIGHTS }, owner);
  for (const { booked, dock, early, urgent, ward } of receiving) {
    const isOwned = ward.tenantId === TENANT;
    expect(readTask(early.id).unloadingPointId).toBe(isOwned ? dock.id : undefined);
    expect(readTask(urgent.id)).toEqual(urgent);
    expect(readTask(booked.id)).toEqual(booked);
    expect(commits.at(-1)?.puts.warehouseInbound?.has(early.id) ?? false).toBe(isOwned);
  }
  expect(commits.at(-1)?.puts.yardQueuePolicies?.has(TENANT)).toBe(true);
  expect(events.slice(fromEvent).map(({ payload }) => payload.case).sort()).toEqual([
    'receivingTasksChanged', 'receivingTasksChanged', 'yardQueuePolicyChanged',
  ]);
});
