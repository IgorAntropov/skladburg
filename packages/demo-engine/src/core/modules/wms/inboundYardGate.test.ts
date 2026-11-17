import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
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
  ReceivedHandlingUnitSchema,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  expect,
  it,
} from 'vitest';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { addSeedReceivingDock } from '../../seed/seedReceivingDocks';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  callAs,
  captureError,
  createModuleHarness,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import {
  assignAvailableInboundDocks,
  openInboundTask,
  readInboundTask,
  requireInboundDock,
  saveInboundTask,
} from './inboundRecords';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const TENANT = SeedOrganizationId.CUSTOMER_1;
const SUPPLIER = SeedOrganizationId.SUPPLIER_1;
const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const AREA = '8f000004-0000-4000-8000-000000000010';
const scope = { receivingAreaId: AREA, tenantId: TENANT, warehouseId: WAREHOUSE };

interface InboundCargoValue {
  arrivedAt: number;
  cargoKind: VehicleCargoKind;
  deliveryEndsAt: number;
}

const saveArrival = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deliveryWarehouse: string,
  cargo?: InboundCargoValue,
): ReceivingTask => {
  const id = nextUuid();
  const at = timestampFromMs(cargo?.arrivedAt ?? transaction.worldTimeMs);
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
    assignment: { driverId: nextUuid(), registrationNumber: 'DEMO-01', vehicleId: nextUuid() },
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
    status: ReceivingTaskStatus.OPEN,
    updDocumentId: nextUuid(),
    version: 1,
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
    requireInboundDock(runtime.read, runtime.errors, { ...blocked, unloadingPointId: readyDock }, TENANT, 'ReceiveHandlingUnit');
  }).toThrow();
  expect(function checkWrongDestination(): void {
    requireInboundDock(runtime.read, runtime.errors, { ...invalid, unloadingPointId: readyDock }, TENANT, 'FinishReceivingTask');
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
    requireInboundDock(runtime.read, runtime.errors, admitted, TENANT, 'ReceiveHandlingUnit');
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
    requireInboundDock(runtime.read, runtime.errors, queued, TENANT, 'ReceiveHandlingUnit');
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
    requireInboundDock(runtime.read, runtime.errors, docked, TENANT, 'ReceiveHandlingUnit');
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
      requireInboundDock(transaction, runtime.errors, legacy, TENANT, 'FinishReceivingTask');
    }).not.toThrow();
    assignAvailableInboundDocks(transaction, runtime, scope);

    return { dockId: dock.id, legacyId: legacy.id, waitingId: waiting.id };
  });

  expect(requireStoredTask(runtime, legacyId).unloadingPointId).toBe(dockId);
  expect(requireStoredTask(runtime, legacyId).receivedUnits).toHaveLength(1);
  expect(requireStoredTask(runtime, waitingId).unloadingPointId).toBeUndefined();
});
