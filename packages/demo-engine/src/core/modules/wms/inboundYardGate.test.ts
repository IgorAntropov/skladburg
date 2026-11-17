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
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import { TripDocumentsService } from '@skladburg/contracts/logistics/v1/trip_documents';
import {
  CarrierTitleSubmissionSchema,
  TripRecordSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';
import {
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

const saveArrival = (transaction: IStateTransaction, runtime: IModuleRuntime, deliveryWarehouse: string): ReceivingTask => {
  const id = nextUuid();
  const at = timestampFromMs(transaction.worldTimeMs);
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
      carrierOrganizationId: SeedOrganizationId.CARRIER_1,
      confirmedAt: at,
      delivery: { organizationId: TENANT, warehouseId: deliveryWarehouse },
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
