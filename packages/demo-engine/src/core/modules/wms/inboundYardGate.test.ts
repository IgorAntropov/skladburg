import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentSchema,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import { TripDocumentsService } from '@skladburg/contracts/logistics/v1/trip_documents';
import {
  CarrierTitleSubmissionSchema,
  TripRecordSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import {
  DockSlotRescheduleReason,
  ReceivedHandlingUnitSchema,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  expect,
  it,
  vi,
} from 'vitest';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { createScheduler } from '../../scheduler/index';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { addSeedReceivingDock } from '../../seed/seedReceivingDocks';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import { createEngineState } from '../../state/index';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import {
  assignAvailableInboundDocks,
  openInboundTask,
  readInboundTask,
  refreshInboundDockSchedules,
  refreshInboundYardAdmission,
  requireInboundDock,
  saveInboundTask,
} from './inboundRecords';
import { saveOutboundTask } from './outboundRecords';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const TENANT = SeedOrganizationId.CUSTOMER_1;
const SUPPLIER = SeedOrganizationId.SUPPLIER_1;
const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const AREA = '8f000004-0000-4000-8000-000000000010';
const MINUTE_MS = 60_000;
const scope = { receivingAreaId: AREA, tenantId: TENANT, warehouseId: WAREHOUSE };

interface InboundCargoValue {
  arrivedAt: number;
  cargoKind: VehicleCargoKind;
  deliveryEndsAt: number;
  plannedArrivalAt?: number | undefined;
}

const saveArrival = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deliveryWarehouse: string,
  cargo?: InboundCargoValue,
): ReceivingTask => {
  const id = nextUuid();
  const at = timestampFromMs(cargo?.arrivedAt ?? transaction.worldTimeMs);
  const planned = cargo?.plannedArrivalAt;
  transaction.put('deals', create(DealSchema, {
    customerOrganizationId: TENANT,
    deliveryMethod: DeliveryMethod.EXCHANGE,
    id,
    shipToWarehouseId: WAREHOUSE,
    status: DealStatus.ARRIVED,
    supplierOrganizationId: SUPPLIER,
    transitions: [{ at, from: DealStatus.IN_TRANSIT, to: DealStatus.ARRIVED }],
  }));
  transaction.put('trips', create(TripRecordSchema, {
    arrivedAt: at,
    assignment: {
      arrivalAt: planned === undefined ? undefined : timestampFromMs(planned),
      driverId: nextUuid(),
      registrationNumber: 'DEMO-01',
      vehicleId: nextUuid(),
    },
    customerOrganizationId: TENANT,
    dealId: id,
    id: nextUuid(),
    status: TripStatus.ARRIVED,
    supplierOrganizationId: SUPPLIER,
    transportOrder: {
      cargo: cargo === undefined ? undefined : { cargoKind: cargo.cargoKind },
      carrierOrganizationId: SeedOrganizationId.CARRIER_1,
      confirmedAt: at,
      delivery: { organizationId: TENANT, warehouseId: deliveryWarehouse },
      deliveryWindow: cargo === undefined ? undefined : { endsAt: timestampFromMs(cargo.deliveryEndsAt) },
    },
    version: 6,
  }));
  const task = create(ReceivingTaskSchema, {
    dealId: id,
    expectedUnits: [{ id: nextUuid() }],
    id,
    orderLines: [{ dealLineId: nextUuid() }],
    receivingAreaId: AREA,
    status: planned === undefined ? ReceivingTaskStatus.OPEN : ReceivingTaskStatus.UNSPECIFIED,
    updDocumentId: nextUuid(),
    version: planned === undefined ? 1 : 0,
    warehouseId: WAREHOUSE,
  });
  transaction.put('documents', create(DocumentSchema, {
    content: { terms: { case: 'upd', value: { lines: [] } } },
    dealId: id,
    displayNumber: 'DEMO-UPD',
    id: task.updDocumentId,
    issuerOrganizationId: SUPPLIER,
    status: DocumentStatus.APPROVED,
    type: DocumentType.UPD,
  }));
  saveInboundTask(transaction, runtime, task, TENANT);
  return task;
};

const saveDispatchTitle = (transaction: IStateTransaction, task: ReceivingTask): void => {
  transaction.put('documents', create(DocumentSchema, {
    content: { terms: { case: 'dispatchTitle', value: {
      shippedAt: timestampFromMs(transaction.worldTimeMs),
      updDocumentId: task.updDocumentId,
    } } },
    dealId: task.dealId,
    displayNumber: 'DEMO-DISPATCH',
    id: nextUuid(),
    issuerOrganizationId: SUPPLIER,
    status: DocumentStatus.APPROVED,
    type: DocumentType.DISPATCH_TITLE,
  }));
};

const requireStoredTask = (runtime: IModuleRuntime, id: string): ReceivingTask => {
  const record = runtime.read.get('warehouseInbound', id);
  if (record === undefined) {
    throw new Error('Missing receiving task');
  }
  return readInboundTask(record, runtime.errors);
};

const saveScheduledArrival = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  plannedArrivalAt: number,
  hasDocuments: boolean,
  arrivedAt: number = transaction.worldTimeMs,
  cargoKind: VehicleCargoKind = VehicleCargoKind.GENERAL,
): ReceivingTask => {
  const task = saveArrival(transaction, runtime, WAREHOUSE, {
    arrivedAt,
    cargoKind,
    deliveryEndsAt: plannedArrivalAt + 60 * MINUTE_MS,
    plannedArrivalAt,
  });
  if (hasDocuments) {
    saveDispatchTitle(transaction, task);
  }
  openInboundTask(transaction, runtime, task.id);
  return task;
};

const createDockTopology = (): ReturnType<typeof createSeedWarehouseTopology> => createSeedWarehouseTopology({
  prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE,
});

const finishScheduledArrival = (transaction: IStateTransaction, runtime: IModuleRuntime, id: string): void => {
  const record = transaction.get('warehouseInbound', id);
  if (record === undefined) {
    throw new Error('Missing receiving task');
  }
  const task = readInboundTask(record, runtime.errors);
  task.status = ReceivingTaskStatus.READY_FOR_RECONCILIATION;
  task.version += 1;
  assignAvailableInboundDocks(transaction, runtime, scope, task);
  saveInboundTask(transaction, runtime, task, TENANT);
};

it('preserves receipt fallback in a saved receiving area without docks and waits for a dock on a new scheduled visit', async () => {
  const { runtime } = createTestRuntime();
  const { legacyId, scheduledId } = await runtime.command((transaction) => {
    const topology = createDockTopology();
    const area = topology.receivingArea;
    if (area === undefined) {
      throw new Error('Missing warehouse area');
    }
    area.unloadingPoint = undefined;
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const legacy = saveArrival(transaction, runtime, WAREHOUSE);
    legacy.status = ReceivingTaskStatus.UNSPECIFIED;
    legacy.version = 0;
    saveInboundTask(transaction, runtime, legacy, TENANT);
    saveDispatchTitle(transaction, legacy);
    openInboundTask(transaction, runtime, legacy.id);
    const scheduled = saveScheduledArrival(transaction, runtime, transaction.worldTimeMs, true);
    return { legacyId: legacy.id, scheduledId: scheduled.id };
  });
  const legacy = requireStoredTask(runtime, legacyId);
  expect(legacy.yardAdmissionStatus).toBe(YardAdmissionStatus.ADMITTED);
  expect(legacy.dockSchedule).toBeUndefined();
  expect(() => {
    requireInboundDock(runtime.read, runtime.errors, legacy, TENANT, 'ReceiveHandlingUnit', runtime.getWorldTimeMs());
  }).not.toThrow();
  const scheduled = requireStoredTask(runtime, scheduledId);
  expect(scheduled.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCK);
  expect(scheduled.dockSchedule?.reservation).toBeUndefined();
  expect(() => {
    requireInboundDock(runtime.read, runtime.errors, scheduled, TENANT, 'ReceiveHandlingUnit', runtime.getWorldTimeMs());
  }).toThrow();
});

it('holds an early visit on the yard, forbids single-dock receipt and assigns it once at the reserved start', async () => {
  const { clock, events, runtime } = createTestRuntime();
  const startsAt = clock.now() + 5 * MINUTE_MS;
  const worldTime = vi.spyOn(clock, 'now');
  const task = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    return saveScheduledArrival(transaction, runtime, startsAt, true);
  });
  const waiting = requireStoredTask(runtime, task.id);
  expect(waiting.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCK);
  expect(waiting.unloadingPointId).toBeUndefined();
  expect(waiting.dockSchedule?.reservation).toMatchObject({
    endsAt: timestampFromMs(startsAt + 30 * MINUTE_MS), startsAt: timestampFromMs(startsAt),
  });
  expect(() => {
    requireInboundDock(runtime.read, runtime.errors, waiting, TENANT, 'ReceiveHandlingUnit', runtime.getWorldTimeMs());
  }).toThrow();

  const eventCount = events.length;
  worldTime.mockReturnValue(startsAt - 1);
  await runtime.command((transaction) => {
    assignAvailableInboundDocks(transaction, runtime, scope);
  });
  expect(requireStoredTask(runtime, task.id)).toEqual(waiting);
  expect(events).toHaveLength(eventCount);
  worldTime.mockReturnValue(startsAt);
  await runtime.command((transaction) => {
    assignAvailableInboundDocks(transaction, runtime, scope);
  });
  const admitted = requireStoredTask(runtime, task.id);
  expect(admitted).toMatchObject({
    dockSchedule: waiting.dockSchedule,
    unloadingPointId: waiting.dockSchedule?.reservation?.unloadingPointId,
    version: waiting.version + 1,
    yardAdmissionStatus: YardAdmissionStatus.ADMITTED,
  });
  await runtime.command((transaction) => {
    assignAvailableInboundDocks(transaction, runtime, scope);
  });
  expect(events).toHaveLength(eventCount + 1);
  expect(requireStoredTask(runtime, task.id)).toEqual(admitted);
});

it.each([
  [0, DockSlotRescheduleReason.UNSPECIFIED],
  [1, DockSlotRescheduleReason.LATE_ARRIVAL],
])('checks actual arrival at the inclusive deadline plus %i ms', async (afterDeadline, reason) => {
  const { runtime } = createTestRuntime();
  const task = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    return saveScheduledArrival(transaction, runtime, transaction.worldTimeMs - 10 * MINUTE_MS - afterDeadline, true);
  });
  const admitted = requireStoredTask(runtime, task.id);
  const slot = admitted.dockSchedule?.reservation;
  expect(admitted.yardAdmissionStatus).toBe(YardAdmissionStatus.ADMITTED);
  expect(admitted.unloadingPointId).toBeDefined();
  expect(admitted.dockSchedule?.lastRescheduleReason).toBe(reason);
  expect(slot?.startsAt === undefined ? undefined : timestampMs(slot.startsAt))
    .toBe(runtime.getWorldTimeMs() - (afterDeadline === 0 ? 10 * MINUTE_MS : 0));
});

it('records late documents separately and moves behind the other visit on the only compatible dock', async () => {
  const { clock, runtime } = createTestRuntime();
  const start = clock.now();
  const worldTime = vi.spyOn(clock, 'now');
  const { blocker, waiting } = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    return {
      blocker: saveScheduledArrival(transaction, runtime, start, true),
      waiting: saveScheduledArrival(transaction, runtime, start, false),
    };
  });
  expect(requireStoredTask(runtime, waiting.id)).toMatchObject({
    dockSchedule: { preferredStartsAt: timestampFromMs(start) }, yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCUMENTS,
  });
  worldTime.mockReturnValue(start + 10 * MINUTE_MS + 1);
  await runtime.command((transaction) => {
    saveDispatchTitle(transaction, waiting);
    refreshInboundYardAdmission(transaction, runtime, waiting.id);
  });
  expect(requireStoredTask(runtime, waiting.id)).toMatchObject({
    dockSchedule: { lastRescheduleReason: DockSlotRescheduleReason.LATE_DOCUMENTS,
      reservation: { startsAt: timestampFromMs(start + 30 * MINUTE_MS) } },
    yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK,
  });
  expect(requireStoredTask(runtime, blocker.id).unloadingPointId).toBeDefined();
  expect(requireStoredTask(runtime, waiting.id).unloadingPointId).toBeUndefined();
});

it.each([false, true])('uses adjacent reservations while physical use overruns or finishes early (%s)', async (finishesEarly) => {
  const { clock, runtime } = createTestRuntime();
  const start = clock.now();
  const end = start + 30 * MINUTE_MS;
  const worldTime = vi.spyOn(clock, 'now');
  const { first, second } = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    return {
      first: saveScheduledArrival(transaction, runtime, start, true),
      second: saveScheduledArrival(transaction, runtime, start, true),
    };
  });
  const firstTask = requireStoredTask(runtime, first.id);
  const originalSecond = requireStoredTask(runtime, second.id);
  expect(firstTask.dockSchedule?.reservation?.endsAt).toEqual(timestampFromMs(end));
  expect(originalSecond.dockSchedule?.reservation?.startsAt).toEqual(timestampFromMs(end));
  expect(originalSecond.unloadingPointId).toBeUndefined();

  if (finishesEarly) {
    worldTime.mockReturnValue(start + 5 * MINUTE_MS);
    await runtime.command((transaction) => {
      finishScheduledArrival(transaction, runtime, first.id);
    });
    expect(requireStoredTask(runtime, second.id)).toEqual(originalSecond);
    expect(requireStoredTask(runtime, first.id).dockSchedule).toEqual(firstTask.dockSchedule);
  }
  worldTime.mockReturnValue(end);
  await refreshInboundDockSchedules(runtime);
  if (finishesEarly) {
    expect(requireStoredTask(runtime, second.id).unloadingPointId).toBe(firstTask.unloadingPointId);
    return;
  }
  expect(requireStoredTask(runtime, second.id)).toEqual(originalSecond);
  worldTime.mockReturnValue(end + 10 * MINUTE_MS + 1);
  await refreshInboundDockSchedules(runtime);
  expect(requireStoredTask(runtime, first.id)).toEqual(firstTask);
  expect(requireStoredTask(runtime, second.id).dockSchedule).toMatchObject({ lastRescheduleReason: DockSlotRescheduleReason.DOCK_BUSY });
  expect(requireStoredTask(runtime, second.id).dockSchedule?.reservation).toBeUndefined();
  await runtime.command((transaction) => {
    finishScheduledArrival(transaction, runtime, first.id);
  });
  const moved = requireStoredTask(runtime, second.id);
  expect(moved.unloadingPointId).toBe(firstTask.unloadingPointId);
  expect(moved.dockSchedule?.reservation?.startsAt).toEqual(timestampFromMs(runtime.getWorldTimeMs()));
});

it('releases all expired unused reservations before allocating a newly available dock in queue order', async () => {
  const { clock, runtime } = createTestRuntime();
  const startsAt = clock.now() + 5 * MINUTE_MS;
  const worldTime = vi.spyOn(clock, 'now');
  const topology = createDockTopology();
  expect(addSeedReceivingDock(topology)).toBe(true);
  const area = topology.receivingArea;
  const primary = area?.unloadingPoint;
  const secondary = area?.additionalUnloadingPoints[0];
  if (primary === undefined || secondary === undefined) {
    throw new Error('Missing warehouse docks');
  }
  const { first, second } = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const first = saveScheduledArrival(transaction, runtime, startsAt, true, transaction.worldTimeMs - 1);
    const second = saveScheduledArrival(transaction, runtime, startsAt, true);
    const blocker = saveArrival(transaction, runtime, WAREHOUSE);
    blocker.unloadingPointId = primary.id;
    saveInboundTask(transaction, runtime, blocker, TENANT);
    return { first, second };
  });
  expect(requireStoredTask(runtime, first.id).dockSchedule?.reservation?.unloadingPointId).toBe(primary.id);
  expect(requireStoredTask(runtime, second.id).dockSchedule?.reservation?.unloadingPointId).toBe(secondary.id);

  worldTime.mockReturnValue(startsAt + 10 * MINUTE_MS + 1);
  await refreshInboundDockSchedules(runtime);
  expect(requireStoredTask(runtime, first.id).unloadingPointId).toBe(secondary.id);
  expect(requireStoredTask(runtime, second.id).unloadingPointId).toBeUndefined();
  expect(requireStoredTask(runtime, second.id).dockSchedule?.reservation?.startsAt)
    .toEqual(timestampFromMs(runtime.getWorldTimeMs() + 30 * MINUTE_MS));
});

it('fits an on-time visit between an already used slot and a confirmed later reservation', async () => {
  const { clock, runtime } = createTestRuntime();
  const start = clock.now();
  const worldTime = vi.spyOn(clock, 'now');
  const { first, future } = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    return {
      first: saveScheduledArrival(transaction, runtime, start, true),
      future: saveScheduledArrival(transaction, runtime, start + 60 * MINUTE_MS, true),
    };
  });
  const confirmedFuture = requireStoredTask(runtime, future.id);
  worldTime.mockReturnValue(start + 25 * MINUTE_MS);
  await runtime.command((transaction) => {
    finishScheduledArrival(transaction, runtime, first.id);
  });
  worldTime.mockReturnValue(start + 33 * MINUTE_MS);
  const middle = await runtime.command(transaction => saveScheduledArrival(transaction, runtime, start + 28 * MINUTE_MS, true));
  expect(requireStoredTask(runtime, middle.id)).toMatchObject({
    dockSchedule: {
      lastRescheduleReason: DockSlotRescheduleReason.SLOT_UNAVAILABLE,
      reservation: { endsAt: timestampFromMs(start + 60 * MINUTE_MS), startsAt: timestampFromMs(start + 30 * MINUTE_MS) },
    },
    unloadingPointId: requireStoredTask(runtime, first.id).unloadingPointId,
  });
  expect(requireStoredTask(runtime, future.id)).toEqual(confirmedFuture);
});

it('keeps the primary dock for an outbound truck and schedules the arrival once the truck departs', async () => {
  const { events, runtime } = createTestRuntime();
  const start = runtime.getWorldTimeMs();
  const topology = createDockTopology();
  const tripId = nextUuid();
  const taskId = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const shipmentId = nextUuid();
    const outbound = create(PickingTaskSchema, {
      dealId: shipmentId,
      id: shipmentId,
      status: PickingTaskStatus.PICKED,
      units: [{ handlingUnit: { tenantId: TENANT, warehouseId: WAREHOUSE } }],
      warehouseId: WAREHOUSE,
    });
    saveOutboundTask(transaction, runtime, outbound, TENANT, false);
    transaction.put('trips', create(TripRecordSchema, {
      dealId: shipmentId, id: tripId, status: TripStatus.ASSIGNED, transportOrder: { pickup: { warehouseId: WAREHOUSE } },
    }));
    return saveScheduledArrival(transaction, runtime, start, true).id;
  });
  const waiting = requireStoredTask(runtime, taskId);
  expect(waiting.unloadingPointId).toBeUndefined();
  expect(waiting.dockSchedule?.reservation).toBeUndefined();
  const before = events.length;
  await runtime.command((transaction) => {
    const trip = transaction.get('trips', tripId);
    if (trip === undefined) {
      throw new Error('Missing outbound trip');
    }
    trip.status = TripStatus.IN_TRANSIT;
    transaction.put('trips', trip);
  });
  await refreshInboundDockSchedules(runtime);
  await refreshInboundDockSchedules(runtime);
  expect(requireStoredTask(runtime, taskId)).toMatchObject({
    unloadingPointId: topology.receivingArea?.unloadingPoint?.id, version: waiting.version + 1,
  });
  expect(events.slice(before).map(event => event.payload.case)).toEqual(['receivingTasksChanged']);
});

it('moves an unstarted cold reservation on a dock change and frees it on loss of documents', async () => {
  const { runtime } = createTestRuntime();
  const startsAt = runtime.getWorldTimeMs() + 5 * MINUTE_MS;
  const topology = createDockTopology();
  expect(addSeedReceivingDock(topology)).toBe(true);
  const area = topology.receivingArea;
  const primary = area?.unloadingPoint;
  const cold = area?.additionalUnloadingPoints[0];
  if (area === undefined || primary === undefined || cold === undefined) {
    throw new Error('Missing warehouse docks');
  }
  cold.capabilities = [WarehouseCapability.COLD];
  primary.capabilities = [WarehouseCapability.RAMP];
  const taskId = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    return saveScheduledArrival(transaction, runtime, startsAt, true, transaction.worldTimeMs, VehicleCargoKind.TEMPERATURE_CONTROLLED).id;
  });
  expect(requireStoredTask(runtime, taskId).dockSchedule?.reservation?.unloadingPointId).toBe(cold.id);
  primary.capabilities = [WarehouseCapability.COLD];
  area.additionalUnloadingPoints = [];
  await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    assignAvailableInboundDocks(transaction, runtime, scope);
  });
  expect(requireStoredTask(runtime, taskId).dockSchedule).toMatchObject({
    lastRescheduleReason: DockSlotRescheduleReason.DOCK_CHANGED,
    reservation: { startsAt: timestampFromMs(startsAt), unloadingPointId: primary.id },
  });
  expect(requireStoredTask(runtime, taskId).unloadingPointId).toBeUndefined();

  await runtime.command((transaction) => {
    for (const document of transaction.listBy('documents', 'dealId', taskId)) {
      if (document.type === DocumentType.DISPATCH_TITLE) {
        transaction.delete('documents', document.id);
      }
    }
    refreshInboundYardAdmission(transaction, runtime, taskId);
  });
  const blocked = requireStoredTask(runtime, taskId);
  expect(blocked.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCUMENTS);
  expect(blocked.dockSchedule?.reservation).toBeUndefined();
});

it('keeps a future slot in a saved snapshot and publishes it only inside the receiving warehouse', async () => {
  const harness = createModuleHarness();
  const { clock, events, runtime, storage, transport } = harness;
  const startsAt = clock.now() + 5 * MINUTE_MS;
  const worldTime = vi.spyOn(clock, 'now');
  const task = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    return saveScheduledArrival(transaction, runtime, startsAt, true);
  });
  const snapshot = await storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing saved warehouse');
  }
  const receiving = createClient(WarehouseReceivingService, transport);
  const { tasks } = await receiving.listReceivingTasks({ warehouseId: WAREHOUSE }, callAs(SeedUserId.ADMIN_1, TENANT));
  const restored = requireStoredTask({ ...runtime, read: createEngineState(snapshot).read }, task.id);
  expect(tasks.find(({ id }) => id === task.id)).toEqual(restored);
  expect(restored.dockSchedule?.reservation?.startsAt).toEqual(timestampFromMs(startsAt));

  const anotherWarehouseUser = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['task_view'], warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2],
  });
  await expect(receiving.listReceivingTasks({ warehouseId: WAREHOUSE }, callAs(anotherWarehouseUser, TENANT))).rejects.toThrow();
  await expect(receiving.listReceivingTasks({ warehouseId: WAREHOUSE }, callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1)))
    .rejects.toThrow();

  const scheduler = createScheduler({
    command: runtime.command,
    getWorldTimeMs: runtime.getWorldTimeMs,
  });
  scheduler.register({
    id: 'inbound-dock-schedules', intervalMs: 1_000, isCoalesced: true, runCommands: () => refreshInboundDockSchedules(runtime),
  });
  const before = events.length;
  worldTime.mockReturnValue(startsAt + 1_000);
  await scheduler.tick();
  await scheduler.tick();
  const done = requireStoredTask(runtime, task.id);
  expect(done.unloadingPointId).toBe(restored.dockSchedule?.reservation?.unloadingPointId);
  expect(done.version).toBe(restored.version + 1);
  expect(events.slice(before).map(event => event.payload.case)).toEqual(['receivingTasksChanged']);
  expect(scheduler.readDueAtMs()['inbound-dock-schedules']).toBe(startsAt + 2_000);
});

it('skips an incomplete arrival and a wrong-warehouse pass, then assigns the first after receiving its documents', async () => {
  const { runtime } = createTestRuntime();
  const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE });
  expect(addSeedReceivingDock(topology)).toBe(true);
  const { blocked, invalid, ready } = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const blocked = saveArrival(transaction, runtime, WAREHOUSE);
    const invalid = saveArrival(transaction, runtime, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);
    const ready = saveArrival(transaction, runtime, WAREHOUSE);
    saveDispatchTitle(transaction, invalid);
    saveDispatchTitle(transaction, ready);
    assignAvailableInboundDocks(transaction, runtime, scope);
    return { blocked, invalid, ready };
  });
  expect(requireStoredTask(runtime, blocked.id).unloadingPointId).toBeUndefined();
  expect(requireStoredTask(runtime, invalid.id).unloadingPointId).toBeUndefined();
  const readyDock = requireStoredTask(runtime, ready.id).unloadingPointId;
  expect(readyDock).toBeDefined();
  expect(function checkWaitingArrival(): void {
    const task = { ...blocked, unloadingPointId: readyDock };
    requireInboundDock(runtime.read, runtime.errors, task, TENANT, 'ReceiveHandlingUnit', runtime.getWorldTimeMs());
  }).toThrow();
  expect(function checkWrongDestination(): void {
    const task = { ...invalid, unloadingPointId: readyDock };
    requireInboundDock(runtime.read, runtime.errors, task, TENANT, 'FinishReceivingTask', runtime.getWorldTimeMs());
  }).toThrow();

  await runtime.command((transaction) => {
    saveDispatchTitle(transaction, blocked);
    assignAvailableInboundDocks(transaction, runtime, scope);
  });
  const admitted = requireStoredTask(runtime, blocked.id);
  expect(admitted.unloadingPointId).toBeDefined();
  expect(admitted.unloadingPointId).not.toBe(readyDock);
  expect(admitted.version).toBe(2);
  expect(requireStoredTask(runtime, ready.id).unloadingPointId).toBe(readyDock);
  expect(function checkAssignedArrival(): void {
    requireInboundDock(runtime.read, runtime.errors, admitted, TENANT, 'ReceiveHandlingUnit', runtime.getWorldTimeMs());
  }).not.toThrow();
});

it('publishes the carrier title and queues the arrival atomically while the only dock is occupied', async () => {
  const { commits, runtime, transport } = createModuleHarness();
  const logistics = createClient(LogisticsService, transport);
  const documents = createClient(TripDocumentsService, transport);
  const { occupiedTaskId, taskId, tripId } = await runtime.command((transaction) => {
    const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE });
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const task = saveArrival(transaction, runtime, WAREHOUSE);
    saveDispatchTitle(transaction, task);
    const [trip] = transaction.listBy('trips', 'dealId', task.dealId);
    if (trip === undefined) {
      throw new Error('Missing inbound trip');
    }
    trip.carrierTitle = create(CarrierTitleSubmissionSchema);
    transaction.put('trips', trip);
    task.status = ReceivingTaskStatus.UNSPECIFIED;
    task.version = 0;
    saveInboundTask(transaction, runtime, task, TENANT);
    openInboundTask(transaction, runtime, task.dealId);
    const occupied = saveArrival(transaction, runtime, WAREHOUSE);
    saveDispatchTitle(transaction, occupied);
    assignAvailableInboundDocks(transaction, runtime, scope);
    return { occupiedTaskId: occupied.id, taskId: task.id, tripId: trip.id };
  });
  const blocked = requireStoredTask(runtime, taskId);
  expect(blocked.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCUMENTS);
  expect(blocked.unloadingPointId).toBeUndefined();

  const request = { expectedVersion: 6, idempotencyKey: nextUuid(), tripId };
  await captureError(documents.submitCarrierTitle(request, callAs(SeedUserId.ADMIN_1, TENANT)));
  expect(requireStoredTask(runtime, taskId)).toEqual(blocked);

  const carrier = callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1);
  const submission = await documents.submitCarrierTitle(request, carrier);
  const occupied = requireStoredTask(runtime, occupiedTaskId);
  expect(occupied.unloadingPointId).toBeDefined();
  const queued = requireStoredTask(runtime, taskId);
  expect(queued).toMatchObject({ version: 2, yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK });
  expect(queued.unloadingPointId).toBeUndefined();
  expect(() => {
    requireInboundDock(runtime.read, runtime.errors, queued, TENANT, 'ReceiveHandlingUnit', runtime.getWorldTimeMs());
  }).toThrow();
  expect(commits.at(-1)?.puts.trips?.has(tripId)).toBe(true);
  expect(commits.at(-1)?.puts.warehouseInbound?.has(taskId)).toBe(true);
  expect(await documents.submitCarrierTitle(request, carrier)).toEqual(submission);
  expect(requireStoredTask(runtime, taskId)).toEqual(queued);
  const { trip } = await logistics.getTrip({ tripId }, carrier);
  expect(trip).toMatchObject({ carrierTitleSubmitted: true, status: TripStatus.ARRIVED, version: 7 });

  await runtime.command((transaction) => {
    occupied.status = ReceivingTaskStatus.READY_FOR_RECONCILIATION;
    saveInboundTask(transaction, runtime, occupied, TENANT);
    assignAvailableInboundDocks(transaction, runtime, scope);
  });
  const docked = requireStoredTask(runtime, taskId);
  expect(docked).toMatchObject({
    unloadingPointId: occupied.unloadingPointId, version: 3, yardAdmissionStatus: YardAdmissionStatus.ADMITTED,
  });
  expect(() => {
    requireInboundDock(runtime.read, runtime.errors, docked, TENANT, 'ReceiveHandlingUnit', runtime.getWorldTimeMs());
  }).not.toThrow();
});

it('assigns the waiting refrigerated load with the earliest delivery deadline ahead of older arrivals', async () => {
  const { runtime } = createTestRuntime();
  const { cold, first, urgent } = await runtime.command((transaction) => {
    const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE });
    const dock = topology.receivingArea?.unloadingPoint;
    if (dock === undefined) {
      throw new Error('Missing warehouse dock');
    }
    dock.capabilities = [WarehouseCapability.COLD];
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const now = transaction.worldTimeMs;
    const first = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 180_000, cargoKind: VehicleCargoKind.GENERAL, deliveryEndsAt: now + 60_000,
    });
    const cold = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 120_000, cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED, deliveryEndsAt: now + 180_000,
    });
    const urgent = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 60_000, cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED, deliveryEndsAt: now + 120_000,
    });
    for (const task of [first, cold, urgent]) {
      saveDispatchTitle(transaction, task);
    }
    assignAvailableInboundDocks(transaction, runtime, scope);

    return { cold, first, urgent };
  });

  expect(requireStoredTask(runtime, first.id).unloadingPointId).toBeUndefined();
  expect(requireStoredTask(runtime, cold.id).unloadingPointId).toBeUndefined();
  expect(requireStoredTask(runtime, urgent.id).unloadingPointId).toBeDefined();
});

it('keeps both docks in use when general cargo can move to the cold dock and long cargo needs the wide dock', async () => {
  const { runtime } = createTestRuntime();
  const { coldDockId, generalId, wideDockId, wideId } = await runtime.command((transaction) => {
    const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE });
    expect(addSeedReceivingDock(topology)).toBe(true);
    const wideDock = topology.receivingArea?.unloadingPoint;
    const coldDock = topology.receivingArea?.additionalUnloadingPoints[0];
    if (wideDock === undefined || coldDock === undefined) {
      throw new Error('Missing warehouse docks');
    }
    wideDock.capabilities = [WarehouseCapability.OVERSIZE];
    coldDock.capabilities = [WarehouseCapability.COLD];
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const now = transaction.worldTimeMs;
    const general = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 120_000, cargoKind: VehicleCargoKind.GENERAL, deliveryEndsAt: now + 60_000,
    });
    const wide = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 60_000, cargoKind: VehicleCargoKind.OVERSIZE, deliveryEndsAt: now + 180_000,
    });
    saveDispatchTitle(transaction, general);
    saveDispatchTitle(transaction, wide);
    assignAvailableInboundDocks(transaction, runtime, scope);
    return { coldDockId: coldDock.id, generalId: general.id, wideDockId: wideDock.id, wideId: wide.id };
  });

  expect(requireStoredTask(runtime, generalId).unloadingPointId).toBe(coldDockId);
  expect(requireStoredTask(runtime, wideId).unloadingPointId).toBe(wideDockId);
});

it('keeps incompatible cargo on the yard while a later ready load uses the only compatible dock', async () => {
  const { runtime } = createTestRuntime();
  const { coldId, dockId, generalId } = await runtime.command((transaction) => {
    const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE });
    const dock = topology.receivingArea?.unloadingPoint;
    if (dock === undefined) {
      throw new Error('Missing warehouse dock');
    }
    dock.capabilities = [WarehouseCapability.RAMP];
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const now = transaction.worldTimeMs;
    const cold = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 120_000, cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED, deliveryEndsAt: now + 60_000,
    });
    const general = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 60_000, cargoKind: VehicleCargoKind.GENERAL, deliveryEndsAt: now + 180_000,
    });
    saveDispatchTitle(transaction, cold);
    saveDispatchTitle(transaction, general);
    cold.status = ReceivingTaskStatus.UNSPECIFIED;
    cold.version = 0;
    saveInboundTask(transaction, runtime, cold, TENANT);
    openInboundTask(transaction, runtime, cold.dealId);
    return { coldId: cold.id, dockId: dock.id, generalId: general.id };
  });

  const waiting = requireStoredTask(runtime, coldId);
  expect(waiting.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCK);
  expect(waiting.unloadingPointId).toBeUndefined();
  expect(requireStoredTask(runtime, generalId).unloadingPointId).toBe(dockId);
});

it('keeps the only dock available to a saved receiving task with a posted scan and no old dock id', async () => {
  const { runtime } = createTestRuntime();
  const { dockId, legacyId, waitingId } = await runtime.command((transaction) => {
    const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE });
    const dock = topology.receivingArea?.unloadingPoint;
    if (dock === undefined) {
      throw new Error('Missing warehouse dock');
    }
    dock.capabilities = [WarehouseCapability.RAMP];
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const now = transaction.worldTimeMs;
    const legacy = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now - 120_000, cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED, deliveryEndsAt: now + 60_000,
    });
    legacy.status = ReceivingTaskStatus.IN_PROGRESS;
    legacy.receivedUnits.push(create(ReceivedHandlingUnitSchema, { expectedUnitId: legacy.expectedUnits[0]?.id }));
    saveInboundTask(transaction, runtime, legacy, TENANT);
    saveDispatchTitle(transaction, legacy);
    const waiting = saveArrival(transaction, runtime, WAREHOUSE);
    saveDispatchTitle(transaction, waiting);

    expect(function checkLegacyReceipt(): void {
      requireInboundDock(transaction, runtime.errors, legacy, TENANT, 'FinishReceivingTask', transaction.worldTimeMs);
    }).not.toThrow();
    assignAvailableInboundDocks(transaction, runtime, scope);

    return { dockId: dock.id, legacyId: legacy.id, waitingId: waiting.id };
  });

  expect(requireStoredTask(runtime, legacyId).unloadingPointId).toBe(dockId);
  expect(requireStoredTask(runtime, legacyId).receivedUnits).toHaveLength(1);
  expect(requireStoredTask(runtime, waitingId).unloadingPointId).toBeUndefined();
});
