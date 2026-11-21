import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  ConnectError,
  createClient,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseEquipmentService,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import {
  expect,
  it,
} from 'vitest';

import { createEngine } from '../../engine/createEngine';
import {
  createEngineTransport,
  createFakeRealTime,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import {
  createEngineState,
  TABLE_DEFINITIONS,
} from '../../state/index';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import {
  encodeWarehouseEquipmentRecord,
  readWarehouseEquipmentRecord,
} from './warehouseEquipmentRecords';

const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const organizationId = SeedOrganizationId.CUSTOMER_1;
const operator = callAs(SeedUserId.WAREHOUSE_OPERATOR, organizationId);
const lead = callAs(SeedUserId.WAREHOUSE_LEAD, organizationId);

it('claims the last machine once for competing tasks and restores both assignments after a rejected write', async () => {
  const source = createSpyStorage();
  await createEngine({ epoch: 'equipment', isDemoWarehouseEnabled: true, realTime: createFakeRealTime(), storage: source });
  const snapshot = await source.load();
  if (snapshot === undefined) {
    throw new Error('Missing demo world');
  }
  const record = readWarehouseEquipmentRecord(createEngineState(snapshot).read, warehouseId);
  const secondUnit = record?.equipment[1]?.unit;
  if (record === undefined || secondUnit === undefined) {
    throw new Error('Missing warehouse equipment');
  }
  secondUnit.status = WarehouseEquipmentStatus.IN_REPAIR;
  const storedFleet = TABLE_DEFINITIONS.warehouseEquipment.encode(encodeWarehouseEquipmentRecord(record));
  const warehouseEquipment = new Map(snapshot.collections.warehouseEquipment).set(warehouseId, storedFleet);
  const warehouseInbound = new Map(snapshot.collections.warehouseInbound);
  for (const [id, stored] of warehouseInbound) {
    const taskRecord = TABLE_DEFINITIONS.warehouseInbound.decode(stored);
    const task = fromBinary(ReceivingTaskSchema, taskRecord.bytes);
    if (task.warehouseId === warehouseId && task.version > 0) {
      task.requiredQualifications = [WarehouseStaffQualificationKind.FORKLIFT];
      const bytes = toBinary(ReceivingTaskSchema, task);
      warehouseInbound.set(id, TABLE_DEFINITIONS.warehouseInbound.encode({ ...taskRecord, bytes }));
    }
  }
  const storage = createSpyStorage({ ...snapshot, collections: { ...snapshot.collections, warehouseEquipment, warehouseInbound } });
  const { engine } = await createTestEngine({ isDemoWarehouseEnabled: true, storage });
  const transport = createEngineTransport(engine, true);
  const client = createClient(WarehouseReceivingService, transport);
  const fleet = createClient(WarehouseEquipmentService, transport);
  const { tasks } = await client.listReceivingTasks({ warehouseId }, lead);
  const [first, second] = tasks;
  if (first === undefined || second === undefined) {
    throw new Error('Missing competing receiving tasks');
  }
  const claim = { expectedVersion: first.version, idempotencyKey: nextUuid(), taskId: first.id, warehouseId };
  const otherClaim = { expectedVersion: second.version, idempotencyKey: nextUuid(), taskId: second.id, warehouseId };
  const original = await fleet.getWarehouseEquipment({ warehouseId }, lead);
  storage.failNextCommit();
  const failed = await captureError(client.claimReceivingTask(claim, operator));
  expect(readErrorDetail(failed).code).toBe(ErrorCode.UNAVAILABLE);
  expect((await client.listReceivingTasks({ warehouseId }, lead)).tasks).toEqual(tasks);
  expect(await fleet.getWarehouseEquipment({ warehouseId }, lead)).toEqual(original);

  const attempts = await Promise.allSettled([client.claimReceivingTask(claim, operator), client.claimReceivingTask(otherClaim, lead)]);
  const accepted = attempts.find(attempt => attempt.status === 'fulfilled');
  const rejected = attempts.find(attempt => attempt.status === 'rejected');
  const winner = accepted?.value.task?.id;
  if (winner === undefined || rejected === undefined) {
    throw new Error('Expected exactly one successful claim');
  }
  expect(readErrorDetail(ConnectError.from(rejected.reason)).code).toBe(ErrorCode.WAREHOUSE_EQUIPMENT_UNAVAILABLE);
  const equipment = (await fleet.getWarehouseEquipment({ warehouseId }, lead)).equipment;
  expect(equipment.filter(unit => unit.status === WarehouseEquipmentStatus.TO_TASK)).toMatchObject([{
    batteryPercent: 20, driverStaffId: winner === first.id ? SeedUserId.WAREHOUSE_OPERATOR : SeedUserId.WAREHOUSE_LEAD, taskId: winner,
  }]);
  const { tasks: assigned } = await client.listReceivingTasks({ warehouseId }, lead);
  expect(assigned.filter(task => task.status === ReceivingTaskStatus.IN_PROGRESS).map(task => task.id)).toEqual([winner]);
  const beforeReplay = storage.commits.length;
  await client.claimReceivingTask(winner === first.id ? claim : otherClaim, winner === first.id ? operator : lead);
  expect(storage.commits).toHaveLength(beforeReplay);
});

it('retains the machine until work finishes and permits placement after charging has started', async () => {
  const engine = await createEngine({
    epoch: 'equipment', isDemoWarehouseEnabled: true, realTime: createFakeRealTime(), storage: createSpyStorage(),
  });
  const transport = createEngineTransport(engine, true);
  const client = createClient(WarehouseReceivingService, transport);
  const fleet = createClient(WarehouseEquipmentService, transport);
  const { tasks } = await client.listReceivingTasks({ warehouseId }, operator);
  const sscc = '000000000000000017';
  const task = tasks.find(candidate => candidate.expectedUnits.some(unit => unit.sscc === sscc));
  if (task === undefined) {
    throw new Error('Missing forklift task');
  }
  const base = { taskId: task.id, warehouseId };
  await client.claimReceivingTask({ ...base, expectedVersion: task.version, idempotencyKey: nextUuid() }, operator);
  const receive = { ...base, expectedVersion: 2, idempotencyKey: nextUuid(), unit: { case: 'sscc', value: sscc } } as const;
  const accepted = await client.receiveHandlingUnit(receive, operator);
  expect(await client.receiveHandlingUnit(receive, operator)).toEqual(accepted);
  const working = await fleet.getWarehouseEquipment({ warehouseId }, lead);
  expect(working.equipment[0]).toMatchObject({
    batteryPercent: 19, driverStaffId: SeedUserId.WAREHOUSE_OPERATOR, status: WarehouseEquipmentStatus.HANDLING, taskId: task.id,
  });
  expect(working.stations[0]?.equipmentId).toBeUndefined();
  const handlingUnitId = accepted.task?.receivedUnits[0]?.balanceAtReceipt?.handlingUnit?.id;
  if (handlingUnitId === undefined) {
    throw new Error('Missing received pallet');
  }
  await client.finishReceivingTask({ ...base, expectedVersion: 3, idempotencyKey: nextUuid() }, operator);
  const charging = await fleet.getWarehouseEquipment({ warehouseId }, lead);
  expect(charging.equipment[0]).toMatchObject({ batteryPercent: 18, status: WarehouseEquipmentStatus.CHARGING });
  expect(charging.stations[0]?.equipmentId).toBe(charging.equipment[0]?.id);
  const toCellId = '8f000004-0000-4000-8000-000000000006';
  const placed = await client.putAwayHandlingUnit({
    ...base, expectedVersion: 4, handlingUnitId, idempotencyKey: nextUuid(), toCellId,
  }, operator);
  expect(placed.task?.receivedUnits[0]?.putAwayCellId).toBe(toCellId);
  expect(await fleet.getWarehouseEquipment({ warehouseId }, lead)).toEqual(charging);
});
