import type {
  ReceivingTask,
  YardWaitingReason,
} from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  DealLineSchema,
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
  DockSlotRescheduleReason,
  ReceivedHandlingUnitSchema,
  ReceivingDockScheduleSchema,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardAdmissionStatus,
  YardDispatchOutcome,
  YardPriorityFactor,
  YardWaitingReasonCode,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
  WarehouseEquipmentTaskKind,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WarehouseEquipmentRecordSchema } from '@skladburg/contracts/wms/v1/warehouse_equipment_records';
import { YardQueuePolicyService } from '@skladburg/contracts/wms/v1/yard_queue_policy';
import {
  expect,
  it,
  vi,
} from 'vitest';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { createEngineTasks } from '../../scheduler/engineTasks';
import { createScheduler } from '../../scheduler/index';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { addSeedReceivingDock } from '../../seed/seedReceivingDocks';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import { createEngineState } from '../../state/index';
import { createTestSupportAccessSession } from '../../state/testRecords';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import {
  assignAvailableInboundDocks,
  createDockScheduleRefresh,
  openInboundTask,
  readInboundTask,
  refreshInboundDockSchedules,
  refreshInboundYardAdmission,
  requireInboundDock,
  saveInboundTask,
} from './inboundRecords';
import { saveOutboundTask } from './outboundRecords';
import { saveWarehouseEquipmentRecord } from './warehouseEquipmentRecords';
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

const saveDispatchQueue = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  hasHolder: boolean,
): { dockId: string; first: ReceivingTask; holder: ReceivingTask | undefined; second: ReceivingTask } => {
  const topology = createDockTopology();
  const dock = topology.receivingArea?.unloadingPoint;
  if (dock === undefined) {
    throw new Error('Missing receiving dock');
  }
  transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
  const first = saveArrival(transaction, runtime, WAREHOUSE);
  const second = saveArrival(transaction, runtime, WAREHOUSE);
  for (const task of [first, second]) {
    task.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
    saveDispatchTitle(transaction, task);
    saveInboundTask(transaction, runtime, task, TENANT);
  }
  const holder = hasHolder ? saveArrival(transaction, runtime, WAREHOUSE) : undefined;
  if (holder !== undefined) {
    holder.unloadingPointId = dock.id;
    saveInboundTask(transaction, runtime, holder, TENANT);
  }
  return { dockId: dock.id, first, holder, second };
};

it('ranks waiting visits before pagination and shows manual options only to warehouse dispatchers', async () => {
  const harness = createModuleHarness();
  const { commits, events, runtime, transport } = harness;
  const dispatcherId = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['task_view', 'yard_manage'], warehouseIds: [WAREHOUSE],
  });
  const viewerId = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['task_view'], warehouseIds: [WAREHOUSE],
  });
  const otherDispatcherId = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['yard_manage'], warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2],
  });
  await runtime.command((transaction) => {
    const viewer = transaction.listBy('memberships', 'userId', viewerId)[0];
    const otherDispatcher = transaction.listBy('memberships', 'userId', otherDispatcherId)[0];
    if (viewer === undefined || otherDispatcher === undefined) {
      throw new Error('Missing dispatch test members');
    }
    transaction.put('memberships', { ...viewer, roleAssignments: [...viewer.roleAssignments, ...otherDispatcher.roleAssignments] });
  });
  const dispatcher = callAs(dispatcherId, TENANT);
  const viewer = callAs(viewerId, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const { first, second } = await runtime.command(transaction => saveDispatchQueue(transaction, runtime, true));
  const request = { warehouseId: WAREHOUSE };
  const readCount = { commits: commits.length, events: events.length };
  const initial = await client.listYardWaitingReasons(request, dispatcher);
  expect(initial.reasons.filter(row => row.receivingTaskId === first.id || row.receivingTaskId === second.id)).toMatchObject([
    { dispatchOptions: { assignableUnloadingPointIds: [], canPromote: true }, queuePosition: 1, receivingTaskId: first.id },
    { dispatchOptions: { assignableUnloadingPointIds: [], canPromote: true }, queuePosition: 2, receivingTaskId: second.id },
  ]);
  const readOnly = await client.listYardWaitingReasons(request, viewer);
  expect(readOnly.reasons.map(row => [row.queuePosition, row.dispatchOptions])).toEqual([
    [1, undefined], [2, undefined], [undefined, undefined],
  ]);
  expect({ commits: commits.length, events: events.length }).toEqual(readCount);

  await client.promoteYardVisit({
    ...request, expectedVersion: second.version, idempotencyKey: nextUuid(), reason: 'В начало очереди', taskId: second.id,
  }, dispatcher);
  const page1 = await client.listYardWaitingReasons({ ...request, page: { pageSize: 1 } }, dispatcher);
  const page2 = await client.listYardWaitingReasons({
    ...request, page: { pageSize: 1, pageToken: page1.page?.nextPageToken },
  }, dispatcher);
  expect([...page1.reasons, ...page2.reasons]).toMatchObject([
    { dispatchOptions: { canPromote: true }, queuePosition: 2, receivingTaskId: first.id },
    { dispatchOptions: { canPromote: false }, queuePosition: 1, receivingTaskId: second.id },
  ]);
});

it('uses confirmed resources for both the task viewer and the dock assignment, keeping an unknown fleet neutral', async () => {
  const harness = createModuleHarness();
  const { runtime, transport } = harness;
  const viewer = callAs(await addTestMember(harness, {
    organizationId: TENANT, permissions: ['task_view'], warehouseIds: [WAREHOUSE],
  }), TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const { dockId, first, holder, second } = await runtime.command((transaction) => {
    const queue = saveDispatchQueue(transaction, runtime, true);
    queue.first.requiredQualifications = [WarehouseStaffQualificationKind.FORKLIFT];
    saveInboundTask(transaction, runtime, queue.first, TENANT);
    transaction.delete('warehouseEquipment', WAREHOUSE);
    return queue;
  });
  if (holder === undefined) {
    throw new Error('Missing occupied dock');
  }
  const readRows = async (): Promise<YardWaitingReason[]> => {
    const { reasons } = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, viewer);
    return reasons.filter(row => row.receivingTaskId === first.id || row.receivingTaskId === second.id);
  };
  expect(await readRows()).toMatchObject([
    { priorityFactors: [], queuePosition: 1, receivingTaskId: first.id },
    { priorityFactors: [], queuePosition: 2, receivingTaskId: second.id },
  ]);
  await runtime.command((transaction) => {
    saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, { tenantId: TENANT, warehouseId: WAREHOUSE }));
  });
  const { length: commitsBeforeRead } = harness.commits;
  const rows = await readRows();
  expect(rows).toMatchObject([
    { priorityFactors: [], queuePosition: 2, receivingTaskId: first.id },
    { priorityFactors: [YardPriorityFactor.AVAILABLE_RESOURCES], queuePosition: 1, receivingTaskId: second.id },
  ]);
  expect(rows.every(row => row.dispatchOptions === undefined)).toBe(true);
  expect(harness.commits).toHaveLength(commitsBeforeRead);
  await runtime.command((transaction) => {
    finishScheduledArrival(transaction, runtime, holder.id);
  });
  expect(requireStoredTask(runtime, first.id).unloadingPointId).toBeUndefined();
  expect(requireStoredTask(runtime, second.id).unloadingPointId).toBe(dockId);
});

it('uses the driver and charged forklift released by FinishReceivingTask in the same dock assignment', async () => {
  const { runtime, transport } = createModuleHarness();
  const { dockId, first, holder, second } = await runtime.command((transaction) => {
    const queue = saveDispatchQueue(transaction, runtime, true);
    const holder = queue.holder;
    const deal = holder === undefined ? undefined : transaction.get('deals', holder.dealId);
    const dealLineId = holder?.orderLines[0]?.dealLineId;
    const expectedUnitId = holder?.expectedUnits[0]?.id;
    if (holder === undefined || deal === undefined || dealLineId === undefined || expectedUnitId === undefined) {
      throw new Error('Missing receiving task at the occupied dock');
    }
    const qualifications = [WarehouseStaffQualificationKind.FORKLIFT, WarehouseStaffQualificationKind.COLD_ROOM];
    queue.first.requiredQualifications = qualifications;
    saveInboundTask(transaction, runtime, queue.first, TENANT);
    const driver = SeedUserId.WAREHOUSE_LEAD;
    const receipt = create(ReceivingTaskSchema, {
      assigneeUserId: driver,
      dealId: holder.dealId,
      expectedUnits: [{ batches: [{ dealLineId, quantityBase: 1n }], id: expectedUnitId }],
      id: holder.id,
      orderLines: [{ dealLineId, quantityBase: 1n }],
      receivedUnits: [{ balanceAtReceipt: { lines: [{ quantityBase: 1n }] }, expectedUnitId }],
      receivingAreaId: AREA,
      requiredQualifications: qualifications,
      status: ReceivingTaskStatus.IN_PROGRESS,
      unloadingPointId: queue.dockId,
      updDocumentId: holder.updDocumentId,
      version: holder.version,
      warehouseId: WAREHOUSE,
    });
    saveDispatchTitle(transaction, receipt);
    saveInboundTask(transaction, runtime, receipt, TENANT);
    deal.lines = [create(DealLineSchema, { id: dealLineId, price: { amountMinor: 100n }, priceUnitCoefficient: 1n, quantity: 1n })];
    transaction.put('deals', deal);
    saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, {
      equipment: [{ unit: {
        batteryPercent: 85, code: 'ПГ-01', driverStaffId: driver, id: nextUuid(), kind: WarehouseEquipmentKind.FORKLIFT,
        status: WarehouseEquipmentStatus.HANDLING, taskId: holder.id, taskKind: WarehouseEquipmentTaskKind.RECEIVING,
      }, updatedAtMs: BigInt(transaction.worldTimeMs) }],
      tenantId: TENANT, warehouseId: WAREHOUSE,
    }));
    return { ...queue, holder: receipt };
  });
  const client = createClient(WarehouseReceivingService, transport);
  const operator = callAs(SeedUserId.WAREHOUSE_LEAD, TENANT);
  const before = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, operator);
  expect(before.reasons.find(row => row.receivingTaskId === second.id))
    .toMatchObject({ priorityFactors: [YardPriorityFactor.AVAILABLE_RESOURCES], queuePosition: 1 });
  expect(before.reasons.find(row => row.receivingTaskId === first.id)).toMatchObject({ priorityFactors: [], queuePosition: 2 });
  const finish = { expectedVersion: holder.version, idempotencyKey: nextUuid(), taskId: holder.id, warehouseId: WAREHOUSE };
  const finished = await client.finishReceivingTask(finish, operator);
  expect(finished.task?.status).toBe(ReceivingTaskStatus.READY_FOR_RECONCILIATION);
  const assigned = requireStoredTask(runtime, first.id);
  expect(assigned.unloadingPointId).toBe(dockId);
  expect(requireStoredTask(runtime, second.id).unloadingPointId).toBeUndefined();
  expect(await client.finishReceivingTask(finish, operator)).toEqual(finished);
  expect(requireStoredTask(runtime, first.id)).toEqual(assigned);
});

it('excludes an unknown fleet for reserved and incompatible visits when comparing work at the receiving area', async () => {
  const { clock, runtime, transport } = createModuleHarness();
  vi.spyOn(clock, 'now').mockReturnValue(Date.UTC(2026, 10, 13, 6));
  const { dockId, first, holder, incompatible, reserved, second } = await runtime.command((transaction) => {
    const queue = saveDispatchQueue(transaction, runtime, true);
    queue.first.requiredQualifications = [WarehouseStaffQualificationKind.COLD_ROOM];
    saveInboundTask(transaction, runtime, queue.first, TENANT);
    transaction.delete('warehouseEquipment', WAREHOUSE);
    const now = transaction.worldTimeMs;
    const incompatible = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now, cargoKind: VehicleCargoKind.OVERSIZE, deliveryEndsAt: now + 2 * 60 * MINUTE_MS,
    });
    const reserved = saveArrival(transaction, runtime, WAREHOUSE);
    const startsAt = timestampFromMs(now + 60 * MINUTE_MS);
    reserved.dockSchedule = create(ReceivingDockScheduleSchema, {
      preferredStartsAt: startsAt,
      reservation: { endsAt: timestampFromMs(now + 90 * MINUTE_MS), startsAt, unloadingPointId: queue.dockId },
    });
    for (const task of [incompatible, reserved]) {
      task.requiredQualifications = [WarehouseStaffQualificationKind.FORKLIFT];
      task.yardAdmissionStatus = YardAdmissionStatus.WAITING_DOCK;
      saveDispatchTitle(transaction, task);
      saveInboundTask(transaction, runtime, task, TENANT);
    }
    return { ...queue, incompatible, reserved };
  });
  if (holder === undefined) {
    throw new Error('Missing occupied dock');
  }
  const client = createClient(WarehouseReceivingService, transport);
  const answer = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, callAs(SeedUserId.ADMIN_1, TENANT));
  const rows = new Map(answer.reasons.map(row => [row.receivingTaskId, row]));
  expect(rows.get(first.id)).toMatchObject({ priorityFactors: [], queuePosition: 2 });
  expect(rows.get(second.id)).toMatchObject({ priorityFactors: [YardPriorityFactor.AVAILABLE_RESOURCES], queuePosition: 1 });
  expect(rows.get(reserved.id)).toMatchObject({ priorityFactors: [], reason: YardWaitingReasonCode.WAITING_SLOT });
  expect(rows.get(reserved.id)?.queuePosition).toBeUndefined();
  expect(rows.get(incompatible.id)).toMatchObject({ priorityFactors: [], reason: YardWaitingReasonCode.NO_COMPATIBLE_DOCK });
  expect(rows.get(incompatible.id)?.queuePosition).toBeUndefined();
  await runtime.command((transaction) => {
    finishScheduledArrival(transaction, runtime, holder.id);
  });
  expect(requireStoredTask(runtime, first.id).unloadingPointId).toBeUndefined();
  expect(requireStoredTask(runtime, second.id).unloadingPointId).toBe(dockId);
  expect(requireStoredTask(runtime, reserved.id).dockSchedule?.reservation).toEqual(reserved.dockSchedule?.reservation);
});

it('records scoped promotions once and spends their order when a dock becomes free', async () => {
  const harness = createModuleHarness();
  const { events, runtime, transport } = harness;
  const userId = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['yard_manage'], warehouseIds: [WAREHOUSE],
  });
  const manager = callAs(userId, TENANT);
  const reader = callAs(await addTestMember(harness, {
    organizationId: TENANT, permissions: ['yard_view'], warehouseIds: [WAREHOUSE],
  }), TENANT);
  const owner = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const { dockId, first, holder, second } = await runtime.command(transaction => saveDispatchQueue(transaction, runtime, true));
  if (holder === undefined) {
    throw new Error('Missing occupied dock');
  }
  const request = { expectedVersion: second.version, idempotencyKey: nextUuid(), reason: ' Разгрузка срочной поставки ', taskId: second.id,
    warehouseId: WAREHOUSE };
  const count = events.length;
  const promoted = await client.promoteYardVisit(request, manager);
  expect(promoted).toMatchObject({ outcome: YardDispatchOutcome.WAITING, taskId: second.id, taskVersion: second.version + 1 });
  expect(await client.promoteYardVisit(request, manager)).toEqual(promoted);
  const reused = await captureError(client.promoteYardVisit({ ...request, reason: 'Другое основание' }, manager));
  expect(readErrorDetail(reused).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
  const stale = await captureError(client.promoteYardVisit({ ...request, idempotencyKey: nextUuid() }, manager));
  expect(readErrorDetail(stale).code).toBe(ErrorCode.VERSION_CONFLICT);
  const alreadyPromoted = await captureError(client.promoteYardVisit({
    ...request, expectedVersion: promoted.taskVersion, idempotencyKey: nextUuid(),
  }, manager));
  expect(readErrorDetail(alreadyPromoted).params).toMatchObject({ value: { reason: 'ALREADY_PROMOTED' } });
  expect(events.slice(count).map(event => event.payload.case)).toEqual(['receivingTasksChanged']);
  const readDenied = await captureError(client.listYardDispatchEntries(request, manager));
  expect(readErrorDetail(readDenied).code).toBe(ErrorCode.PERMISSION_DENIED);
  const foreignRead = await captureError(client.listYardDispatchEntries(request, callAs(SeedUserId.ADMIN_2, SUPPLIER)));
  expect(readErrorDetail(foreignRead).code).toBe(ErrorCode.NOT_FOUND);
  const writeDenied = await captureError(client.promoteYardVisit(request, reader));
  expect(readErrorDetail(writeDenied).code).toBe(ErrorCode.PERMISSION_DENIED);
  const { entries: [entry] } = await client.listYardDispatchEntries(request, reader);
  expect(entry).toMatchObject({
    actorUserId: userId,
    after: { isManuallyPrioritized: true, taskVersion: second.version + 1 },
    before: { isManuallyPrioritized: false, taskVersion: second.version },
    id: promoted.entryId,
    reason: request.reason.trim(),
    sequence: 1n,
  });
  const { reasons } = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, owner);
  expect(reasons.find(row => row.receivingTaskId === second.id)?.priorityFactors).toContain(YardPriorityFactor.MANUAL_PROMOTION);
  await client.promoteYardVisit({ ...request, expectedVersion: first.version, idempotencyKey: nextUuid(), taskId: first.id }, manager);
  await createClient(YardQueuePolicyService, transport).saveYardQueuePolicy({
    expectedVersion: 0n,
    idempotencyKey: nextUuid(),
    weights: {
      cargoUrgencyWeight: 0, deliveryWindowWeight: 0, explicitUrgencyWeight: 0, resourceAvailabilityWeight: 0, waitingTimeWeight: 0,
    },
  }, owner);
  await runtime.command((transaction) => {
    finishScheduledArrival(transaction, runtime, holder.id);
  });
  expect(requireStoredTask(runtime, second.id).unloadingPointId).toBe(dockId);
  expect(requireStoredTask(runtime, first.id).unloadingPointId).toBeUndefined();
  const journal = await client.listYardDispatchEntries({ warehouseId: WAREHOUSE }, reader);
  expect(journal.entries.map(item => item.sequence)).toEqual([2n, 1n]);
});

it('assigns a compatible dock atomically and denies a second visit and a missing reason', async () => {
  const { events, runtime, transport } = createModuleHarness();
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const { dockId, first, second } = await runtime.command(transaction => saveDispatchQueue(transaction, runtime, false));
  const base = { expectedVersion: first.version, idempotencyKey: nextUuid(), reason: 'Приёмка по решению диспетчера',
    taskId: first.id, unloadingPointId: dockId, warehouseId: WAREHOUSE };
  const blank = await captureError(client.assignYardVisitToDock({ ...base, reason: '   ' }, caller));
  expect(readErrorDetail(blank).code).toBe(ErrorCode.VALIDATION_FAILED);
  const count = events.length;
  const assigned = await client.assignYardVisitToDock(base, caller);
  expect(assigned).toMatchObject({ outcome: YardDispatchOutcome.DOCK_ASSIGNED, taskId: first.id, unloadingPointId: dockId });
  expect(await client.assignYardVisitToDock(base, caller)).toEqual(assigned);
  const blocked = await captureError(client.assignYardVisitToDock({
    ...base, expectedVersion: second.version, idempotencyKey: nextUuid(), taskId: second.id,
  }, caller));
  expect(readErrorDetail(blocked)).toMatchObject({
    code: ErrorCode.YARD_DISPATCH_BLOCKED,
    params: { case: 'yardDispatchBlocked', value: { reason: 'DOCK_BUSY' } },
  });
  expect(events.slice(count).map(event => event.payload.case)).toEqual(['receivingTasksChanged']);
  const { entries } = await client.listYardDispatchEntries({ warehouseId: WAREHOUSE }, caller);
  expect(entries.map(({ id }) => id)).toEqual([assigned.entryId]);
});

it('keeps manual dispatch and its journal inaccessible from an active warehouse support session', async () => {
  const { events, runtime, transport } = createModuleHarness();
  const staffId = SeedUserId.OPERATOR_SUPER_ADMIN_1;
  const sessionId = nextUuid();
  const { dockId, first } = await runtime.command((transaction) => {
    transaction.put('supportAccessSessions', createTestSupportAccessSession(sessionId, TENANT, staffId, SupportAccessStatus.ACTIVE, {
      expiresAt: timestampFromMs(transaction.worldTimeMs + 60 * MINUTE_MS),
      mode: SupportAccessMode.EDIT,
      section: SupportAccessSection.WAREHOUSES,
    }));
    return saveDispatchQueue(transaction, runtime, false);
  });
  const caller = callAs(staffId, TENANT);
  const headers = new Headers(caller.headers);
  headers.set(SUPPORT_SESSION_HEADER, sessionId);
  const client = createClient(WarehouseReceivingService, transport);
  const request = {
    expectedVersion: first.version,
    idempotencyKey: nextUuid(),
    reason: 'Подача ожидающей машины',
    taskId: first.id,
    warehouseId: WAREHOUSE,
  };
  const count = events.length;
  const { reasons } = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, { headers });
  expect(reasons).toHaveLength(2);
  expect(reasons.every(row => row.dispatchOptions === undefined)).toBe(true);
  const denied = await Promise.all([
    captureError(client.promoteYardVisit(request, { headers })),
    captureError(client.assignYardVisitToDock({ ...request, unloadingPointId: dockId }, { headers })),
    captureError(client.listYardDispatchEntries({ warehouseId: WAREHOUSE }, { headers })),
  ]);
  for (const error of denied) {
    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  }
  expect(requireStoredTask(runtime, first.id)).toEqual(first);
  expect((await client.listYardDispatchEntries({ warehouseId: WAREHOUSE }, callAs(SeedUserId.ADMIN_1, TENANT))).entries).toHaveLength(0);
  expect(events).toHaveLength(count);
});

it('protects a confirmed reservation and admits its visit exactly ten minutes after the start', async () => {
  const { clock, events, runtime, transport } = createModuleHarness();
  const start = clock.now() + 5 * MINUTE_MS;
  const worldTime = vi.spyOn(clock, 'now');
  const { dockId, otherDockId, task } = await runtime.command((transaction) => {
    const topology = createDockTopology();
    expect(addSeedReceivingDock(topology)).toBe(true);
    const otherDock = topology.receivingArea?.additionalUnloadingPoints[0];
    if (otherDock === undefined) {
      throw new Error('Missing alternate dock');
    }
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const saved = saveScheduledArrival(transaction, runtime, start, true);
    const task = requireStoredTask({ ...runtime, read: transaction }, saved.id);
    const dockId = task.dockSchedule?.reservation?.unloadingPointId;
    const otherDockId = [
      topology.receivingArea?.unloadingPoint?.id, otherDock.id,
    ].find(id => id !== undefined && id !== dockId);
    if (dockId === undefined || otherDockId === undefined) {
      throw new Error('Missing booked or alternate dock');
    }
    return { dockId, otherDockId, task };
  });
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const request = { expectedVersion: task.version, idempotencyKey: nextUuid(), reason: 'Подача в подтверждённое окно',
    taskId: task.id, warehouseId: WAREHOUSE };
  const count = events.length;
  worldTime.mockReturnValue(start - 1);
  const beforeSlot = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, caller);
  const beforeVisit = beforeSlot.reasons.find(row => row.receivingTaskId === task.id);
  expect(beforeVisit?.queuePosition).toBeUndefined();
  expect(beforeVisit?.dispatchOptions).toMatchObject({ assignableUnloadingPointIds: [], canPromote: false });
  const tooEarly = await captureError(client.assignYardVisitToDock({ ...request, unloadingPointId: dockId }, caller));
  expect(readErrorDetail(tooEarly).params).toMatchObject({ value: { reason: 'SLOT_NOT_STARTED' } });
  const promote = await captureError(client.promoteYardVisit(request, caller));
  expect(readErrorDetail(promote).params).toMatchObject({ value: { reason: 'RESERVATION_PROTECTED' } });
  worldTime.mockReturnValue(start + 10 * MINUTE_MS);
  const atGraceLimit = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, caller);
  expect(atGraceLimit.reasons.find(row => row.receivingTaskId === task.id)?.dispatchOptions?.assignableUnloadingPointIds).toEqual([dockId]);
  const reassign = await captureError(client.assignYardVisitToDock({ ...request, unloadingPointId: otherDockId }, caller));
  expect(readErrorDetail(reassign).params).toMatchObject({ value: { reason: 'RESERVATION_PROTECTED' } });
  expect(requireStoredTask(runtime, task.id)).toEqual(task);
  expect(events).toHaveLength(count);
  const assigned = await client.assignYardVisitToDock({ ...request, unloadingPointId: dockId }, caller);
  expect(assigned.outcome).toBe(YardDispatchOutcome.DOCK_ASSIGNED);
  expect(assigned.reservation).toEqual(task.dockSchedule?.reservation);
  expect((await client.listYardDispatchEntries(request, caller)).entries).toHaveLength(1);
});

it.each([29, 30])('checks a full immediate interval before a reservation %i minutes away', async (minutes) => {
  const { runtime, transport } = createModuleHarness();
  const { dockId, first, reserved } = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    const future = saveScheduledArrival(transaction, runtime, transaction.worldTimeMs + minutes * MINUTE_MS, true);
    const reserved = requireStoredTask({ ...runtime, read: transaction }, future.id);
    return { ...saveDispatchQueue(transaction, runtime, false), reserved };
  });
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const request = { expectedVersion: first.version, idempotencyKey: nextUuid(), reason: 'Ручная подача',
    taskId: first.id, unloadingPointId: dockId, warehouseId: WAREHOUSE };
  const { reasons } = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, caller);
  expect(reasons.find(row => row.receivingTaskId === first.id)?.dispatchOptions?.assignableUnloadingPointIds)
    .toEqual(minutes === 29 ? [] : [dockId]);
  if (minutes === 29) {
    const error = await captureError(client.assignYardVisitToDock(request, caller));
    expect(readErrorDetail(error).params).toMatchObject({ value: { reason: 'RESERVATION_PROTECTED' } });
    expect((await client.listYardDispatchEntries(request, caller)).entries).toHaveLength(0);
  }
  else {
    const assigned = await client.assignYardVisitToDock(request, caller);
    expect(assigned.outcome).toBe(YardDispatchOutcome.DOCK_ASSIGNED);
  }
  expect(requireStoredTask(runtime, reserved.id)).toEqual(reserved);
});

it('leaves the journal and waiting task unchanged if appending the dispatch entry fails', async () => {
  const { events, runtime, transport } = createModuleHarness();
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const { first, second } = await runtime.command(transaction => saveDispatchQueue(transaction, runtime, true));
  const request = { expectedVersion: first.version, idempotencyKey: nextUuid(), reason: 'Изменение очереди',
    taskId: first.id, warehouseId: WAREHOUSE };
  const accepted = await client.promoteYardVisit(request, caller);
  const count = events.length;
  const uuid = vi.spyOn(runtime.random, 'uuid').mockReturnValue(accepted.entryId);
  try {
    const failed = await captureError(client.promoteYardVisit({
      ...request, expectedVersion: second.version, idempotencyKey: nextUuid(), taskId: second.id,
    }, caller));
    expect(readErrorDetail(failed).code).toBe(ErrorCode.INTERNAL);
  }
  finally {
    uuid.mockRestore();
  }
  expect(runtime.read.get('warehouseInbound', second.id)?.manualPrioritySequence).toBeUndefined();
  expect(requireStoredTask(runtime, second.id)).toEqual(second);
  expect(events).toHaveLength(count);
  expect((await client.listYardDispatchEntries(request, caller)).entries.map(row => row.id)).toEqual([accepted.entryId]);
});

it('blocks manual action for missing admission, cargo incompatibility and outbound use of the primary dock', async () => {
  const { events, runtime, transport } = createModuleHarness();
  const { dockId, docs, invalid, outboundId, oversized, reefer, standard } = await runtime.command((transaction) => {
    const topology = createDockTopology();
    const dock = topology.receivingArea?.unloadingPoint;
    if (dock === undefined) {
      throw new Error('Missing receiving dock');
    }
    dock.capabilities = [WarehouseCapability.RAMP];
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const now = transaction.worldTimeMs;
    const docs = saveArrival(transaction, runtime, WAREHOUSE);
    const invalid = saveArrival(transaction, runtime, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);
    const reefer = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now, cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED, deliveryEndsAt: now + MINUTE_MS,
    });
    const oversized = saveArrival(transaction, runtime, WAREHOUSE, {
      arrivedAt: now, cargoKind: VehicleCargoKind.OVERSIZE, deliveryEndsAt: now + MINUTE_MS,
    });
    const standard = saveArrival(transaction, runtime, WAREHOUSE);
    for (const task of [reefer, oversized, standard]) {
      saveDispatchTitle(transaction, task);
    }
    const outboundId = nextUuid();
    const picking = create(PickingTaskSchema, {
      dealId: outboundId,
      id: outboundId,
      status: PickingTaskStatus.PICKED,
      units: [{ handlingUnit: { tenantId: TENANT, warehouseId: WAREHOUSE } }],
      version: 1,
      warehouseId: WAREHOUSE,
    });
    saveOutboundTask(transaction, runtime, picking, TENANT, false);
    return { dockId: dock.id, docs, invalid, outboundId, oversized, reefer, standard };
  });
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const count = events.length;
  const { reasons: initialReasons } = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, caller);
  const dockOptions = (task: ReceivingTask): string[] | undefined =>
    initialReasons.find(row => row.receivingTaskId === task.id)?.dispatchOptions?.assignableUnloadingPointIds;
  expect(dockOptions(standard)).toEqual([]);
  expect(initialReasons.find(row => row.receivingTaskId === standard.id)?.queuePosition).toBe(1);
  for (const task of [docs, invalid, reefer, oversized]) {
    expect(initialReasons.find(row => row.receivingTaskId === task.id)?.queuePosition).toBeUndefined();
    expect(dockOptions(task)).toEqual([]);
  }
  for (const { reason, task } of [
    { reason: 'WAITING_DOCUMENTS', task: docs },
    { reason: 'PASS_REJECTED', task: invalid },
    { reason: 'INCOMPATIBLE_DOCK', task: reefer },
    { reason: 'INCOMPATIBLE_DOCK', task: oversized },
    { reason: 'DOCK_BUSY', task: standard },
  ]) {
    const error = await captureError(client.assignYardVisitToDock({
      expectedVersion: task.version, idempotencyKey: nextUuid(), reason: 'Подача', taskId: task.id,
      unloadingPointId: dockId, warehouseId: WAREHOUSE,
    }, caller));
    expect(readErrorDetail(error).params).toMatchObject({ value: { reason } });
  }
  const unknownDock = await captureError(client.assignYardVisitToDock({
    expectedVersion: standard.version, idempotencyKey: nextUuid(), reason: 'Подача', taskId: standard.id,
    unloadingPointId: nextUuid(), warehouseId: WAREHOUSE,
  }, caller));
  expect(readErrorDetail(unknownDock).params).toMatchObject({ value: { reason: 'DOCK_NOT_FOUND' } });
  expect((await client.listYardDispatchEntries({ warehouseId: WAREHOUSE }, caller)).entries).toHaveLength(0);
  expect(events).toHaveLength(count);
  const promotion = await client.promoteYardVisit({
    expectedVersion: standard.version,
    idempotencyKey: nextUuid(),
    reason: 'Следом за отгрузкой',
    taskId: standard.id,
    warehouseId: WAREHOUSE,
  }, caller);
  expect(promotion.outcome).toBe(YardDispatchOutcome.WAITING);
  const { reasons } = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, caller);
  expect(reasons.find(row => row.receivingTaskId === standard.id)?.reason).toBe(YardWaitingReasonCode.DOCKS_BUSY);
  await runtime.command((transaction) => {
    transaction.delete('warehouseOutbound', outboundId);
  });
  await refreshInboundDockSchedules(runtime);
  expect(requireStoredTask(runtime, standard.id).unloadingPointId).toBe(dockId);
});

it('opens a new manual slot after the old reserved start exceeds the grace period', async () => {
  const { clock, runtime, transport } = createModuleHarness();
  const start = clock.now() + 5 * MINUTE_MS;
  const worldTime = vi.spyOn(clock, 'now');
  const task = await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createDockTopology()));
    const scheduled = saveScheduledArrival(transaction, runtime, start, true);
    return requireStoredTask({ ...runtime, read: transaction }, scheduled.id);
  });
  const unloadingPointId = task.dockSchedule?.reservation?.unloadingPointId;
  if (unloadingPointId === undefined) {
    throw new Error('Missing original reservation');
  }
  const now = start + 10 * MINUTE_MS + 1;
  worldTime.mockReturnValue(now);
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  const request = { expectedVersion: task.version, idempotencyKey: nextUuid(), reason: 'Окно освобождено',
    taskId: task.id, unloadingPointId, warehouseId: WAREHOUSE };
  const { reasons } = await client.listYardWaitingReasons({ warehouseId: WAREHOUSE }, caller);
  const expired = reasons.find(row => row.receivingTaskId === task.id);
  expect(expired).toMatchObject({
    dispatchOptions: { assignableUnloadingPointIds: [unloadingPointId], canPromote: true }, queuePosition: 1,
  });
  const assigned = await client.assignYardVisitToDock(request, caller);
  expect(assigned.reservation).toEqual({
    ...task.dockSchedule?.reservation, endsAt: timestampFromMs(now + 30 * MINUTE_MS), startsAt: timestampFromMs(now),
  });
  const { entries: [entry] } = await client.listYardDispatchEntries(request, caller);
  expect(entry?.before?.reservation).toEqual(task.dockSchedule?.reservation);
  expect(entry?.after?.reservation).toEqual(assigned.reservation);
});

it('clears the one-use promotion when admission is lost without restoring it when documents return', async () => {
  const { runtime, transport } = createModuleHarness();
  const { first } = await runtime.command(transaction => saveDispatchQueue(transaction, runtime, true));
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const client = createClient(WarehouseReceivingService, transport);
  await client.promoteYardVisit({
    expectedVersion: first.version, idempotencyKey: nextUuid(), reason: 'Продвинуть приёмку', taskId: first.id, warehouseId: WAREHOUSE,
  }, caller);
  await runtime.command((transaction) => {
    for (const doc of transaction.listBy('documents', 'dealId', first.id)) {
      if (doc.type === DocumentType.DISPATCH_TITLE) {
        transaction.delete('documents', doc.id);
      }
    }
    refreshInboundYardAdmission(transaction, runtime, first.id);
  });
  expect(requireStoredTask(runtime, first.id).yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCUMENTS);
  expect(runtime.read.get('warehouseInbound', first.id)?.manualPrioritySequence).toBeUndefined();
  await runtime.command((transaction) => {
    saveDispatchTitle(transaction, first);
    refreshInboundYardAdmission(transaction, runtime, first.id);
  });
  expect(runtime.read.get('warehouseInbound', first.id)?.manualPrioritySequence).toBeUndefined();
  expect((await client.listYardDispatchEntries({ warehouseId: WAREHOUSE }, caller)).entries).toHaveLength(1);
});

it('projects current waiting causes and eligible factors for the scoped warehouse without writing state', async () => {
  const harness = createModuleHarness();
  const { commits, events, runtime, transport } = harness;
  const caller = callAs(await addTestMember(harness, {
    organizationId: TENANT, permissions: ['task_view'], warehouseIds: [WAREHOUSE],
  }), TENANT);
  const denied = callAs(await addTestMember(harness, {
    organizationId: TENANT, permissions: ['warehouse_view'], warehouseIds: [WAREHOUSE],
  }), TENANT);
  const fixtures = await runtime.command((transaction) => {
    const topology = createDockTopology();
    const dock = topology.receivingArea?.unloadingPoint;
    if (dock === undefined) {
      throw new Error('Missing receiving dock');
    }
    dock.capabilities = [WarehouseCapability.OVERSIZE];
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const now = transaction.worldTimeMs;
    const rejected = saveArrival(transaction, runtime, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);
    const documents = saveScheduledArrival(transaction, runtime, now, false);
    const incompatible = saveScheduledArrival(transaction, runtime, now, true, now, VehicleCargoKind.TEMPERATURE_CONTROLLED);
    const future = saveScheduledArrival(transaction, runtime, now + 5 * MINUTE_MS, true, now - 15 * MINUTE_MS);
    return { documents, future, incompatible, rejected };
  });
  const counts = { commits: commits.length, events: events.length };
  const receiving = createClient(WarehouseReceivingService, transport);
  const request = { warehouseId: WAREHOUSE };
  const { reasons } = await receiving.listYardWaitingReasons(request, caller);
  const readReason = (task: ReceivingTask): (typeof reasons)[number] | undefined => reasons.find(row => row.receivingTaskId === task.id);
  expect(readReason(fixtures.rejected)).toMatchObject({ priorityFactors: [], reason: YardWaitingReasonCode.PASS_REJECTED });
  expect(readReason(fixtures.documents)).toMatchObject({ priorityFactors: [], reason: YardWaitingReasonCode.WAITING_DOCUMENTS });
  expect(readReason(fixtures.incompatible)).toMatchObject({ priorityFactors: [], reason: YardWaitingReasonCode.NO_COMPATIBLE_DOCK });
  expect(readReason(fixtures.future)).toMatchObject({
    reason: YardWaitingReasonCode.WAITING_SLOT,
    taskVersion: requireStoredTask(runtime, fixtures.future.id).version,
  });
  expect(readReason(fixtures.future)?.priorityFactors).toContain(YardPriorityFactor.WAITING_TIME);
  const first = await receiving.listYardWaitingReasons({ ...request, page: { pageSize: 1 } }, caller);
  const second = await receiving.listYardWaitingReasons({
    ...request, page: { pageSize: 1, pageToken: first.page?.nextPageToken },
  }, caller);
  expect([...first.reasons, ...second.reasons]).toEqual(reasons.slice(0, 2));
  const deniedRead = await captureError(receiving.listYardWaitingReasons(request, denied));
  expect(readErrorDetail(deniedRead).code).toBe(ErrorCode.PERMISSION_DENIED);
  const foreignRead = await captureError(receiving.listYardWaitingReasons(request, callAs(SeedUserId.ADMIN_2, SUPPLIER)));
  expect(readErrorDetail(foreignRead).code).toBe(ErrorCode.NOT_FOUND);
  expect({ commits: commits.length, events: events.length }).toEqual(counts);
});

it('publishes a waiting reason update at the reserved start when the booked dock stays occupied', async () => {
  const { clock, events, runtime, transport } = createModuleHarness();
  const startsAt = clock.now() + 5 * MINUTE_MS;
  const worldTime = vi.spyOn(clock, 'now');
  const scheduled = await runtime.command((transaction) => {
    const topology = createDockTopology();
    const dock = topology.receivingArea?.unloadingPoint;
    if (dock === undefined) {
      throw new Error('Missing receiving dock');
    }
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    const future = saveScheduledArrival(transaction, runtime, startsAt, true);
    const holder = saveArrival(transaction, runtime, WAREHOUSE);
    holder.unloadingPointId = dock.id;
    saveInboundTask(transaction, runtime, holder, TENANT);
    return requireStoredTask({ ...runtime, read: transaction }, future.id);
  });
  const schedulerTask = createEngineTasks({
    ...runtime, refreshInboundDockSchedules: createDockScheduleRefresh(runtime.getWorldTimeMs()),
  }).find(task => task.id === 'inbound-dock-schedules');
  if (schedulerTask === undefined) {
    throw new Error('Missing dock scheduler');
  }
  const scheduler = createScheduler({ command: runtime.command, getWorldTimeMs: runtime.getWorldTimeMs });
  scheduler.register(schedulerTask);
  const receiving = createClient(WarehouseReceivingService, transport);
  const caller = callAs(SeedUserId.ADMIN_1, TENANT);
  const readReason = async (): Promise<undefined | YardWaitingReasonCode> => {
    const { reasons } = await receiving.listYardWaitingReasons({ warehouseId: WAREHOUSE }, caller);
    return reasons.find(row => row.receivingTaskId === scheduled.id)?.reason;
  };
  expect(await readReason()).toBe(YardWaitingReasonCode.WAITING_SLOT);
  const eventCount = events.length;
  worldTime.mockReturnValue(startsAt);
  await scheduler.tick();
  expect(requireStoredTask(runtime, scheduled.id)).toEqual(scheduled);
  expect(await readReason()).toBe(YardWaitingReasonCode.BOOKED_DOCK_BUSY);
  expect(events.slice(eventCount).map(({ payload }) => payload.case)).toEqual(['receivingTasksChanged']);
  worldTime.mockReturnValue(startsAt + 1_000);
  await scheduler.tick();
  expect(events).toHaveLength(eventCount + 1);
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
  const { runtime, transport } = createModuleHarness();
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
  const receiving = createClient(WarehouseReceivingService, transport);
  const { reasons } = await receiving.listYardWaitingReasons({ warehouseId: WAREHOUSE }, callAs(SeedUserId.ADMIN_1, TENANT));
  expect(reasons.find(row => row.receivingTaskId === legacyId)).toBeUndefined();
  expect(reasons.find(row => row.receivingTaskId === scheduledId)?.reason).toBe(YardWaitingReasonCode.NO_COMPATIBLE_DOCK);
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
