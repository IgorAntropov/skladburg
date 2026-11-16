import type { Event } from '@skladburg/contracts/event/v1/event';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import {
  Code,
  createClient,
} from '@connectrpc/connect';
import { MarkingMode } from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';
import {
  PaymentService,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseRackSchema,
  WarehouseTopologyService,
} from '@skladburg/contracts/wms/v1/topology';
import {
  expect,
  it,
} from 'vitest';

import { createEngine } from '../engine/index';
import {
  createEngineTransport,
  createFakeRealTime,
  createSpyStorage,
} from '../engine/testing/engineHarness';
import {
  CARRIER_CALL,
  CUSTOMER_CALL,
} from '../modules/catalog/showcase/testing/showcaseFixtures';
import { nextUuid } from '../modules/catalog/testing/catalogFixtures';
import {
  captureError,
  readErrorDetail,
} from '../modules/testing/moduleHarness';
import { encodeWarehouseTopology } from '../modules/wms/warehouseTopologyCodec';
import { createMemoryStorage } from '../ports/index';
import { TABLE_DEFINITIONS } from '../state/index';
import {
  SeedOrganizationId,
  SeedWarehouseId,
} from './seedIds';
import { addSeedReceivingDock } from './seedReceivingDocks';
import { createSeedWarehouseTopology } from './seedWarehouseTopologies';

const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const FIRST_DOCK = '8f000004-0000-4000-8000-000000000011';
const SECOND_DOCK = '8f000004-0000-4000-8000-000000000012';
const CELL = '8f000004-0000-4000-8000-000000000006';

interface ReceiptCommandValue {
  expectedVersion: number;
  idempotencyKey: string;
  taskId: string;
  warehouseId: string;
}

const buildCommand = (taskId: string, expectedVersion: number): ReceiptCommandValue =>
  ({ expectedVersion, idempotencyKey: nextUuid(), taskId, warehouseId });

it('opens the demo receipts in a fresh and reset warehouse world', async () => {
  const realTime = createFakeRealTime();
  const storage = createMemoryStorage();
  const engine = await createEngine({ epoch: 'rehearsal', isDemoWarehouseEnabled: true, realTime, storage });
  const transport = createEngineTransport(engine, true);
  const receiving = createClient(WarehouseReceivingService, transport);
  const deals = createClient(DealService, transport);
  const payments = createClient(PaymentService, transport);
  const { tasks } = await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL);

  expect(tasks.map(task => task.expectedUnits[0]?.sscc)).toEqual(['000000000000000017', '000000000000000024', '000000000000000031']);
  expect(tasks.map(task => task.unloadingPointId)).toEqual([FIRST_DOCK, SECOND_DOCK, undefined]);
  const firstPage = await receiving.listReceivingTasks({ page: { pageSize: 1 }, warehouseId }, CUSTOMER_CALL);
  const nextPageRequest = { page: { pageSize: 1, pageToken: firstPage.page?.nextPageToken }, warehouseId };
  const next = await receiving.listReceivingTasks(nextPageRequest, CUSTOMER_CALL);
  expect(firstPage.tasks[0]?.id).toBe(tasks[0]?.id);
  expect(next.tasks[0]?.id).toBe(tasks[1]?.id);
  expect(tasks.every(task => task.status === ReceivingTaskStatus.OPEN && task.updDocumentId !== '')).toBe(true);
  const marked = tasks.find(task => task.orderLines[0]?.markingMode === MarkingMode.UNIT);
  const plain = tasks.find(task => task.orderLines[0]?.markingMode === MarkingMode.NONE);
  expect(plain?.expectedUnits.map(unit => unit.sscc)).toEqual(['000000000000000017', undefined]);
  const codes = marked?.expectedUnits[0]?.batches[0]?.markingCodes;
  expect(codes).toHaveLength(3);
  expect(new Set(codes).size).toBe(3);
  expect(marked?.orderLines[0]?.quantityBase).toBe(3n);
  expect(hasGs1CheckDigit(marked?.orderLines[0]?.gtin ?? '')).toBe(true);
  for (const task of tasks) {
    expect((await deals.getDeal({ dealId: task.dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.ARRIVED);
    expect((await payments.getDealPayment({ dealId: task.dealId }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.HELD);
  }
  const mainWarehouse = await receiving.listReceivingTasks({ warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 }, CUSTOMER_CALL);
  expect(mainWarehouse.tasks).toEqual([]);
  await expect(receiving.listReceivingTasks({ warehouseId }, CARRIER_CALL)).rejects.toMatchObject({ code: Code.PermissionDenied });

  const reopened = await createEngine({ epoch: 'reopened', isDemoWarehouseEnabled: true, realTime, storage });
  const saved = createClient(WarehouseReceivingService, createEngineTransport(reopened, true));
  expect((await saved.listReceivingTasks({ warehouseId }, CUSTOMER_CALL)).tasks).toEqual(tasks);
  if (plain === undefined) {
    throw new Error('Missing the first demo receipt');
  }
  const claim = await receiving.claimReceivingTask({
    expectedVersion: plain.version, idempotencyKey: '10000000-0000-4000-8000-000000000001', taskId: plain.id, warehouseId,
  }, CUSTOMER_CALL);
  expect(claim.task?.status).toBe(ReceivingTaskStatus.IN_PROGRESS);
  const completion = await receiving.finishReceivingTask({
    expectedVersion: plain.version + 1, idempotencyKey: '10000000-0000-4000-8000-000000000002', taskId: plain.id, warehouseId,
  }, CUSTOMER_CALL);
  expect(completion.task?.status).toBe(ReceivingTaskStatus.READY_FOR_RECONCILIATION);
  expect((await receiving.listReceivingTasks(nextPageRequest, CUSTOMER_CALL)).tasks[0]?.id).toBe(marked?.id);
  await engine.reset('reset');
  expect((await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL)).tasks).toEqual(tasks);
});

it('keeps two parallel unloads independent and atomically promotes the waiting receipt', async () => {
  const storage = createSpyStorage();
  const engine = await createEngine({ epoch: 'parallel', isDemoWarehouseEnabled: true, realTime: createFakeRealTime(), storage });
  const receiving = createClient(WarehouseReceivingService, createEngineTransport(engine, true));
  const { tasks } = await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL);
  const [first, second, waiting] = tasks;
  if (first === undefined || second === undefined || waiting === undefined) {
    throw new Error('Missing demo receipts for parallel docks');
  }

  const claims = await Promise.all(tasks.map(task => receiving.claimReceivingTask(buildCommand(task.id, task.version), CUSTOMER_CALL)));
  expect(claims.map(({ task }) => task?.unloadingPointId)).toEqual([FIRST_DOCK, SECOND_DOCK, undefined]);
  const scan = (taskId: string, value: string): ReturnType<typeof receiving.receiveHandlingUnit> => receiving.receiveHandlingUnit({
    ...buildCommand(taskId, 2), unit: { case: 'sscc', value },
  }, CUSTOMER_CALL);
  const receipts = await Promise.all([scan(first.id, '000000000000000017'), scan(second.id, '000000000000000024')]);
  expect(receipts.map(({ task }) => task?.receivedUnits[0]?.balanceAtReceipt?.handlingUnit?.sscc))
    .toEqual(['000000000000000017', '000000000000000024']);
  expect(readErrorDetail(await captureError(scan(waiting.id, '000000000000000031'))).code).toBe(ErrorCode.INVALID_TRANSITION);
  expect(readErrorDetail(await captureError(receiving.finishReceivingTask(buildCommand(waiting.id, 2), CUSTOMER_CALL))).code)
    .toBe(ErrorCode.INVALID_TRANSITION);

  const batches: (readonly Event[])[] = [];
  const subscription = engine.subscribe(tasksChannel(warehouseId), new Headers(CUSTOMER_CALL.headers), batch => batches.push(batch));
  expect(subscription.kind).toBe('subscribed');
  const release = buildCommand(first.id, 3);
  storage.failNextCommit();
  expect(readErrorDetail(await captureError(receiving.finishReceivingTask(release, CUSTOMER_CALL))).code).toBe(ErrorCode.UNAVAILABLE);
  const afterFailure = await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL);
  expect(afterFailure.tasks.map(task => task.unloadingPointId)).toEqual([FIRST_DOCK, SECOND_DOCK, undefined]);
  expect(batches).toEqual([]);

  const completed = await receiving.finishReceivingTask(release, CUSTOMER_CALL);
  const promoted = await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL);
  expect(completed.task).toMatchObject({ status: ReceivingTaskStatus.READY_FOR_RECONCILIATION, unloadingPointId: FIRST_DOCK });
  expect(promoted.tasks).toMatchObject([
    { id: first.id, unloadingPointId: FIRST_DOCK, version: 4 },
    { id: second.id, unloadingPointId: SECOND_DOCK, version: 3 },
    { id: waiting.id, status: ReceivingTaskStatus.IN_PROGRESS, unloadingPointId: FIRST_DOCK, version: 3 },
  ]);
  expect(batches.map(batch => batch.map(event => event.payload.case))).toEqual([['receivingTasksChanged', 'receivingTasksChanged']]);
  await expect(receiving.finishReceivingTask(release, CUSTOMER_CALL)).resolves.toEqual(completed);
  const handlingUnitId = receipts[0].task?.receivedUnits[0]?.balanceAtReceipt?.handlingUnit?.id ?? '';
  await expect(receiving.putAwayHandlingUnit({ ...buildCommand(first.id, 4), handlingUnitId, toCellId: CELL }, CUSTOMER_CALL))
    .resolves.toMatchObject({ task: { receivedUnits: [{ putAwayCellId: CELL }], unloadingPointId: FIRST_DOCK } });
});

it('upgrades a saved Kazan topology and existing tasks without adding deals or changing stock', async () => {
  const realTime = createFakeRealTime();
  const storage = createSpyStorage();
  const engine = await createEngine({ epoch: 'original', isDemoWarehouseEnabled: true, realTime, storage });
  const transport = createEngineTransport(engine, true);
  const { topology } = await createClient(WarehouseTopologyService, transport).getWarehouseTopology({ warehouseId }, CUSTOMER_CALL);
  const receiving = createClient(WarehouseReceivingService, transport);
  const { tasks } = await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL);
  const snapshot = await storage.load();
  if (snapshot === undefined || topology?.receivingArea?.footprint === undefined || tasks[2] === undefined) {
    throw new Error('Missing saved receiving examples');
  }

  topology.receivingArea.footprint.widthMm = 2_000;
  topology.receivingArea.additionalUnloadingPoints = [];
  const warehouseTopologies = new Map(snapshot.collections.warehouseTopologies);
  warehouseTopologies.set(warehouseId, TABLE_DEFINITIONS.warehouseTopologies.encode(encodeWarehouseTopology(topology)));
  const warehouseInbound = new Map(snapshot.collections.warehouseInbound);
  warehouseInbound.delete(tasks[2].id);
  for (const task of tasks.slice(0, 2)) {
    const stored = warehouseInbound.get(task.id);
    if (stored === undefined) {
      throw new Error('Missing saved receiving task');
    }
    const record = TABLE_DEFINITIONS.warehouseInbound.decode(stored);
    record.bytes = toBinary(ReceivingTaskSchema, { ...task, unloadingPointId: undefined });
    warehouseInbound.set(task.id, TABLE_DEFINITIONS.warehouseInbound.encode(record));
  }
  const collections = { ...snapshot.collections, warehouseInbound, warehouseTopologies };
  await storage.replaceAll({ ...snapshot, collections });

  const reopen = async (epoch: string): Promise<ReturnType<typeof createEngineTransport>> =>
    createEngineTransport(await createEngine({ epoch, isDemoWarehouseEnabled: true, realTime, storage }), true);
  const reopened = await reopen('upgraded');
  expect((await createClient(WarehouseTopologyService, reopened).getWarehouseTopology({ warehouseId }, CUSTOMER_CALL)).topology)
    .toMatchObject({ receivingArea: { additionalUnloadingPoints: [{ id: SECOND_DOCK }], footprint: { widthMm: 8_000 } }, revision: 2 });
  const assigned = await createClient(WarehouseReceivingService, reopened).listReceivingTasks({ warehouseId }, CUSTOMER_CALL);
  expect(assigned.tasks).toMatchObject([
    { id: tasks[0]?.id, unloadingPointId: FIRST_DOCK, version: 2 },
    { id: tasks[1]?.id, unloadingPointId: SECOND_DOCK, version: 2 },
  ]);
  const upgraded = await storage.load();
  expect(upgraded?.collections.deals).toEqual(collections.deals);
  expect(upgraded?.collections.stockBalances).toEqual(collections.stockBalances);
  expect(upgraded?.collections.stockMovements).toEqual(collections.stockMovements);
  const replacements = storage.replaceAllCount();
  const again = await reopen('again');
  expect(await createClient(WarehouseReceivingService, again).listReceivingTasks({ warehouseId }, CUSTOMER_CALL)).toEqual(assigned);
  expect(storage.replaceAllCount()).toBe(replacements);
});

it('leaves a saved Kazan rack in place when it overlaps the second dock approach', () => {
  const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: SeedOrganizationId.CUSTOMER_1, warehouseId });
  const row = topology.storageZones[0]?.rows[0];
  if (row === undefined) {
    throw new Error('Missing receiving fixture row');
  }
  row.racks.push(create(WarehouseRackSchema, {
    code: 'S02',
    footprint: { depthMm: 500, origin: { xMm: 6_900, zMm: 1_100 }, widthMm: 700 },
    id: nextUuid(),
  }));
  const original = encodeWarehouseTopology(topology);

  expect(addSeedReceivingDock(topology)).toBe(false);
  expect(encodeWarehouseTopology(topology)).toEqual(original);
});

it('leaves an already saved world without demo receipts when it is reopened', async () => {
  const realTime = createFakeRealTime();
  const storage = createMemoryStorage();
  await createEngine({ epoch: 'saved', realTime, storage });
  const saved = await storage.load();
  const reopened = await createEngine({ epoch: 'reopened', isDemoWarehouseEnabled: true, realTime, storage });
  const receiving = createClient(WarehouseReceivingService, createEngineTransport(reopened, true));
  const { tasks } = await receiving.listReceivingTasks({ warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3 }, CUSTOMER_CALL);

  expect(tasks).toEqual([]);
  expect((await storage.load())?.collections.deals).toEqual(saved?.collections.deals);
});
