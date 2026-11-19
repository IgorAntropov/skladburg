import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  TripRecordSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';
import { SUPPORT_SESSION_HEADER } from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardVehicleAccent,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  expect,
  it,
} from 'vitest';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createTestSupportAccessSession } from '../../state/testRecords';
import {
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { saveInboundTask } from './inboundRecords';
import { saveOutboundTask } from './outboundRecords';

const CUSTOMER = SeedOrganizationId.CUSTOMER_1;
const SUPPLIER = SeedOrganizationId.SUPPLIER_1;
const CARRIER = SeedOrganizationId.CARRIER_1;
const DELIVERY = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const PICKUP = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
const OTHER_WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
const RECEIPT_CALL = callAs(SeedUserId.ADMIN_1, CUSTOMER);
const DEMO_PLATE = 'А001АА 000';

interface VisitOptionsValue {
  carrierId?: string | undefined;
  deliveryMethod?: DeliveryMethod | undefined;
  hasNoAssignment?: boolean | undefined;
  pickup?: string | undefined;
  supplierId?: string | undefined;
  tripDelivery?: string | undefined;
  tripStatus?: TripStatus | undefined;
}

const saveVisit = (transaction: IStateTransaction, runtime: IModuleRuntime, options: VisitOptionsValue = {}): string => {
  const {
    carrierId = CARRIER,
    deliveryMethod = DeliveryMethod.EXCHANGE,
    hasNoAssignment = false,
    pickup = PICKUP,
    supplierId = SUPPLIER,
    tripDelivery = DELIVERY,
    tripStatus = TripStatus.ARRIVED,
  } = options;
  const taskId = nextUuid();
  transaction.put('deals', create(DealSchema, {
    customerOrganizationId: CUSTOMER,
    deliveryMethod,
    id: taskId,
    shipFromWarehouseId: pickup,
    shipToWarehouseId: DELIVERY,
    status: DealStatus.ARRIVED,
    supplierOrganizationId: supplierId,
  }));
  const tripId = nextUuid();
  transaction.put('trips', create(TripRecordSchema, {
    assignment: hasNoAssignment ? undefined : { driverId: nextUuid(), registrationNumber: DEMO_PLATE, vehicleId: nextUuid() },
    customerOrganizationId: CUSTOMER,
    dealId: taskId,
    id: tripId,
    status: tripStatus,
    supplierOrganizationId: supplierId,
    transportOrder: {
      carrierOrganizationId: carrierId,
      confirmedAt: timestampFromMs(transaction.worldTimeMs),
      delivery: { organizationId: CUSTOMER, warehouseId: tripDelivery },
      pickup: { organizationId: supplierId, warehouseId: pickup },
    },
    version: 2,
  }));
  saveInboundTask(transaction, runtime, create(ReceivingTaskSchema, {
    dealId: taskId,
    expectedUnits: [{ id: nextUuid() }],
    id: taskId,
    orderLines: [{ dealLineId: nextUuid() }],
    receivingAreaId: nextUuid(),
    status: ReceivingTaskStatus.IN_PROGRESS,
    version: 1,
    warehouseId: DELIVERY,
  }), CUSTOMER);
  saveOutboundTask(transaction, runtime, create(PickingTaskSchema, {
    dealId: taskId,
    id: taskId,
    status: PickingTaskStatus.PICKED,
    units: [{ handlingUnit: { id: nextUuid(), tenantId: supplierId, warehouseId: pickup } }],
    version: 1,
    warehouseId: pickup,
  }), supplierId, true);
  return taskId;
};

const prepare = async (options?: VisitOptionsValue): Promise<{
  client: ReturnType<typeof createClient<typeof WarehouseReceivingService>>;
  harness: ModuleHarnessValue;
  taskId: string;
}> => {
  const harness = createModuleHarness();
  const { runtime, transport } = harness;
  const taskId = await runtime.command(transaction => saveVisit(transaction, runtime, options));
  return { client: createClient(WarehouseReceivingService, transport), harness, taskId };
};

const addCaller = async (
  harness: ModuleHarnessValue,
  permissions: readonly string[],
  organizationId: string = CUSTOMER,
  warehouseIds: readonly string[] = [],
): Promise<ReturnType<typeof callAs>> => {
  const userId = await addTestMember(harness, { organizationId, permissions, warehouseIds });
  return callAs(userId, organizationId);
};

it('returns the assigned plate and minimal owner brand to both participants on their matching warehouse sides', async () => {
  const { client, harness, taskId } = await prepare();
  const commitsBefore = harness.commits.length;
  const eventsBefore = harness.events.length;
  const expected = {
    $typeName: 'wms.v1.YardVehicleMarking',
    brand: {
      $typeName: 'wms.v1.YardVehicleBrand',
      logo: { $typeName: 'organization.v1.OrganizationLogo', darkUrl: 'logos/carrier-1-dark.svg', lightUrl: 'logos/carrier-1-light.svg' },
      name: 'Северный холод',
      organizationId: CARRIER,
      yardAccent: YardVehicleAccent.BLUE,
    },
    registrationNumber: DEMO_PLATE,
    taskId,
  };
  for (const [warehouseId, caller] of [[DELIVERY, RECEIPT_CALL], [PICKUP, SUPPLIER_1_CALL]] as const) {
    const result = await client.listYardVehicleMarkings({ taskIds: [taskId], warehouseId }, caller);
    expect(result.markings).toEqual([expected]);
  }
  expect(harness.commits).toHaveLength(commitsBefore);
  expect(harness.events).toHaveLength(eventsBefore);
});

it('keeps trip and brand rights independent of warehouse task access', async () => {
  const { client, harness, taskId } = await prepare();
  const taskOnly = await addCaller(harness, ['task_view'], CUSTOMER, [DELIVERY]);
  const brandOnly = await addCaller(harness, ['network_view', 'task_view']);
  const plateOnly = await addCaller(harness, ['task_view', 'trip_view']);
  const tripOnly = await addCaller(harness, ['network_view', 'trip_view']);
  const wrongScope = await addCaller(harness, ['task_view'], CUSTOMER, [OTHER_WAREHOUSE]);
  const scopedTrip = await addCaller(harness, ['network_view', 'task_view', 'trip_view'], CUSTOMER, [DELIVERY]);
  const request = { taskIds: [taskId], warehouseId: DELIVERY };
  expect((await client.listYardVehicleMarkings(request, taskOnly)).markings).toEqual([{ $typeName: 'wms.v1.YardVehicleMarking', taskId }]);
  const visibleBrand = (await client.listYardVehicleMarkings(request, brandOnly)).markings[0];
  expect(visibleBrand?.brand?.organizationId).toBe(CARRIER);
  expect(visibleBrand).not.toHaveProperty('registrationNumber');
  const visiblePlate = (await client.listYardVehicleMarkings(request, plateOnly)).markings[0];
  expect(visiblePlate?.registrationNumber).toBe(DEMO_PLATE);
  expect(visiblePlate).not.toHaveProperty('brand');
  const warehouseScoped = (await client.listYardVehicleMarkings(request, scopedTrip)).markings[0];
  expect(warehouseScoped).not.toHaveProperty('registrationNumber');
  expect(warehouseScoped).not.toHaveProperty('brand');
  for (const caller of [tripOnly, wrongScope]) {
    expect(readErrorDetail(await captureError(client.listYardVehicleMarkings(request, caller))).code).toBe(ErrorCode.PERMISSION_DENIED);
  }
});

it('limits fleet-only plate visibility to the owner with access to their own warehouse', async () => {
  const carrierId = SeedOrganizationId.SUPPLIER_4;
  const warehouseId = SeedWarehouseId.SUPPLIER_4_WAREHOUSE_1;
  const { client, harness, taskId } = await prepare({ carrierId, pickup: warehouseId, supplierId: carrierId });
  const fleetOwner = await addCaller(harness, ['fleet_view', 'task_view'], carrierId);
  const fleetParticipant = await addCaller(harness, ['fleet_view', 'task_view']);
  const owned = (await client.listYardVehicleMarkings({ taskIds: [taskId], warehouseId }, fleetOwner)).markings[0];
  expect(owned).toMatchObject({ brand: { name: 'Серый камень', organizationId: carrierId }, registrationNumber: DEMO_PLATE });
  const participant = (await client.listYardVehicleMarkings({ taskIds: [taskId], warehouseId: DELIVERY }, fleetParticipant)).markings[0];
  expect(participant).not.toHaveProperty('registrationNumber');
  expect(readErrorDetail(await captureError(client.listYardVehicleMarkings({ taskIds: [taskId], warehouseId: DELIVERY }, fleetOwner))).code)
    .toBe(ErrorCode.NOT_FOUND);
});

it('keeps a foreign unverified brand out of the projection while the participant retains trip access', async () => {
  const { client, taskId } = await prepare({ carrierId: SeedOrganizationId.SUPPLIER_5 });
  const { markings } = await client.listYardVehicleMarkings({ taskIds: [taskId], warehouseId: DELIVERY }, RECEIPT_CALL);
  expect(markings).toEqual([{ $typeName: 'wms.v1.YardVehicleMarking', registrationNumber: DEMO_PLATE, taskId }]);
});

it('uses supplier and customer brands for direct deliveries and pickups without borrowing a plate from a mismatched trip', async () => {
  const { client, harness, taskId: supplierDelivery } = await prepare({ deliveryMethod: DeliveryMethod.SUPPLIER });
  const { runtime } = harness;
  const selfPickup = await runtime.command(transaction => saveVisit(transaction, runtime, { deliveryMethod: DeliveryMethod.CUSTOMER }));
  const request = { taskIds: [selfPickup, supplierDelivery], warehouseId: DELIVERY };
  const { markings } = await client.listYardVehicleMarkings(request, RECEIPT_CALL);
  expect(markings.map(({ brand, taskId }) => [taskId, brand?.organizationId])).toEqual([
    [supplierDelivery, SUPPLIER],
    [selfPickup, CUSTOMER],
  ]);
  expect(markings.every(marking => !Object.hasOwn(marking, 'registrationNumber'))).toBe(true);
});

it('returns no assigned markings for trips without an assignment, with a cancellation or with a different delivery point', async () => {
  const { client, harness, taskId: unassigned } = await prepare({ hasNoAssignment: true, tripStatus: TripStatus.CONFIRMED });
  const { runtime } = harness;
  const [cancelled, misplaced] = await runtime.command(transaction => [
    saveVisit(transaction, runtime, { tripStatus: TripStatus.CANCELLED }),
    saveVisit(transaction, runtime, { tripDelivery: OTHER_WAREHOUSE }),
  ]);
  const request = { taskIds: [cancelled, misplaced, unassigned], warehouseId: DELIVERY };
  const { markings } = await client.listYardVehicleMarkings(request, RECEIPT_CALL);
  expect(markings).toEqual([unassigned, cancelled, misplaced].map(taskId => ({ $typeName: 'wms.v1.YardVehicleMarking', taskId })));
});

it('omits foreign and unknown visits and bounds and validates a batch of task identifiers', async () => {
  const { client, taskId } = await prepare();
  const unknown = nextUuid();
  const batch = [taskId, ...Array.from({ length: 99 }, nextUuid)];
  const { markings } = await client.listYardVehicleMarkings({ taskIds: batch, warehouseId: DELIVERY }, RECEIPT_CALL);
  expect(markings.map(marking => marking.taskId)).toEqual([taskId]);
  for (const taskIds of [[], [taskId, taskId], ['wrong'], [...batch, unknown]]) {
    expect(readErrorDetail(await captureError(client.listYardVehicleMarkings({ taskIds, warehouseId: DELIVERY }, RECEIPT_CALL))).code)
      .toBe(ErrorCode.VALIDATION_FAILED);
  }
  expect(await client.listYardVehicleMarkings({ taskIds: [taskId, unknown], warehouseId: OTHER_WAREHOUSE }, RECEIPT_CALL))
    .toMatchObject({ markings: [] });
  const foreign = await captureError(client.listYardVehicleMarkings({ taskIds: [taskId], warehouseId: DELIVERY }, SUPPLIER_1_CALL));
  expect(readErrorDetail(foreign).code).toBe(ErrorCode.NOT_FOUND);
});

it('pages eligible requested visits in a stable order and rejects a cursor outside that batch', async () => {
  const { client, harness, taskId: first } = await prepare();
  const { runtime } = harness;
  const second = await runtime.command(transaction => saveVisit(transaction, runtime));
  const excluded = nextUuid();
  const input = { taskIds: [second, excluded, first], warehouseId: DELIVERY };
  const pageOne = await client.listYardVehicleMarkings({ ...input, page: { pageSize: 1 } }, RECEIPT_CALL);
  expect(pageOne.markings.map(({ taskId }) => taskId)).toEqual([first]);
  expect(pageOne.page?.nextPageToken).toBe(first);
  const pageTwo = await client.listYardVehicleMarkings({ ...input, page: { pageSize: 1, pageToken: first } }, RECEIPT_CALL);
  expect(pageTwo.markings.map(({ taskId }) => taskId)).toEqual([second]);
  expect(pageTwo.page?.nextPageToken).toBe('');
  const invalidPage = { pageSize: 1, pageToken: excluded };
  const invalid = await captureError(client.listYardVehicleMarkings({ ...input, page: invalidPage }, RECEIPT_CALL));
  expect(readErrorDetail(invalid).code).toBe(ErrorCode.VALIDATION_FAILED);
});

it('keeps a warehouse-only support session from viewing fleet and logistics details', async () => {
  const { client, harness, taskId } = await prepare();
  const staffId = SeedUserId.OPERATOR_SUPER_ADMIN_1;
  const sessionId = nextUuid();
  await harness.runtime.command((transaction) => {
    transaction.put('supportAccessSessions', createTestSupportAccessSession(sessionId, CUSTOMER, staffId, SupportAccessStatus.ACTIVE, {
      expiresAt: timestampFromMs(transaction.worldTimeMs + 60_000),
      mode: SupportAccessMode.VIEW,
      section: SupportAccessSection.WAREHOUSES,
    }));
  });
  const headers = new Headers(callAs(staffId, CUSTOMER).headers);
  headers.set(SUPPORT_SESSION_HEADER, sessionId);
  expect((await client.listYardVehicleMarkings({ taskIds: [taskId], warehouseId: DELIVERY }, { headers })).markings)
    .toEqual([{ $typeName: 'wms.v1.YardVehicleMarking', taskId }]);
});
