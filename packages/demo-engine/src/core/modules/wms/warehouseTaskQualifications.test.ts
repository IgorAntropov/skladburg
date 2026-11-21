import {
  create,
  type MessageInitShape,
  toBinary,
} from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  ErrorCode,
  type ErrorDetailSchema,
  WarehouseStaffQualificationFailure,
} from '@skladburg/contracts/common/v1/error';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  PickingTaskSchema,
  PickingTaskStatus,
  WarehousePickingService,
} from '@skladburg/contracts/wms/v1/picking';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import { StockBalanceSchema } from '@skladburg/contracts/wms/v1/stock';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WarehouseEquipmentRecordSchema } from '@skladburg/contracts/wms/v1/warehouse_equipment_records';
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
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { saveOutboundTask } from './outboundRecords';
import { buildSsccKey } from './stockRecords';
import {
  readWarehouseEquipmentRecord,
  saveWarehouseEquipmentRecord,
} from './warehouseEquipmentRecords';

const forklift = WarehouseStaffQualificationKind.FORKLIFT;
const coldRoom = WarehouseStaffQualificationKind.COLD_ROOM;

const failureDetail = (
  kind: WarehouseStaffQualificationKind, reason: WarehouseStaffQualificationFailure,
): MessageInitShape<typeof ErrorDetailSchema> => ({
  code: ErrorCode.WAREHOUSE_STAFF_QUALIFICATION_REQUIRED,
  params: { case: 'warehouseStaffQualificationRequired', value: { kind, reason } },
});

it('checks the explicit demo work at claim, including local midnight and replays after expiry', async () => {
  const storage = createSpyStorage();
  const realTime = createFakeRealTime();
  const engine = await createEngine({ epoch: 'qualifications', isDemoWarehouseEnabled: true, realTime, storage });
  const client = createClient(WarehouseReceivingService, createEngineTransport(engine, true));
  const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
  const director = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
  const picker = callAs(SeedUserId.WAREHOUSE_PICKER, SeedOrganizationId.CUSTOMER_1);
  const { tasks } = await client.listReceivingTasks({ warehouseId }, director);
  const lifting = tasks.find(task => task.expectedUnits.some(unit => unit.sscc === '000000000000000017'));
  const manual = tasks.find(task => task.expectedUnits.some(unit => unit.sscc === '000000000000000024'));
  const snapshot = await storage.load();
  if (lifting === undefined || manual === undefined || snapshot === undefined) {
    throw new Error('Missing demo receiving tasks');
  }
  expect(lifting.requiredQualifications).toEqual([forklift]);
  expect(manual.requiredQualifications).toEqual([]);
  const claim = { expectedVersion: lifting.version, idempotencyKey: nextUuid(), taskId: lifting.id, warehouseId };
  const lastLocalMidnight = Date.UTC(2027, 9, 12, 21);
  const { timeScale, worldTimeMs } = engine.getClockSnapshot();
  realTime.advance((lastLocalMidnight - 1 - worldTimeMs) / timeScale);
  const [denied, accepted] = await Promise.all([
    captureError(client.claimReceivingTask({ ...claim, idempotencyKey: nextUuid() }, picker)),
    client.claimReceivingTask(claim, director),
  ]);
  expect(readErrorDetail(denied)).toMatchObject(failureDetail(forklift, WarehouseStaffQualificationFailure.EXPIRED));
  expect(accepted.task).toMatchObject({ assigneeUserId: SeedUserId.ADMIN_1, status: ReceivingTaskStatus.IN_PROGRESS, version: 2 });
  realTime.advance(1 / timeScale);
  await expect(client.claimReceivingTask(claim, director)).resolves.toEqual(accepted);
  await expect(client.finishReceivingTask({ ...claim, expectedVersion: 2, idempotencyKey: nextUuid() }, director))
    .resolves.toMatchObject({ task: { status: ReceivingTaskStatus.READY_FOR_RECONCILIATION } });
  await expect(client.claimReceivingTask({
    expectedVersion: manual.version, idempotencyKey: nextUuid(), taskId: manual.id, warehouseId,
  }, picker)).resolves.toMatchObject({ task: { assigneeUserId: SeedUserId.WAREHOUSE_PICKER } });

  const restored = await createTestEngine({
    isDemoWarehouseEnabled: true,
    storage: createSpyStorage({ ...snapshot, meta: { ...snapshot.meta, worldTimeMs: lastLocalMidnight } }),
  });
  const afterMidnight = createClient(WarehouseReceivingService, createEngineTransport(restored.engine, true));
  const expired = await captureError(afterMidnight.claimReceivingTask(claim, director));
  expect(readErrorDetail(expired)).toMatchObject(failureDetail(forklift, WarehouseStaffQualificationFailure.EXPIRED));
  const open = (await afterMidnight.listReceivingTasks({ warehouseId }, director)).tasks.find(task => task.id === lifting.id);
  expect(open).toEqual(lifting);
});

it('leaves the picking task, deal and events unchanged when one of two required qualifications is missing', async () => {
  const { clock, events, runtime, transport } = createModuleHarness();
  const warehouseId = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
  const organizationId = SeedOrganizationId.SUPPLIER_1;
  const userId = SeedUserId.ADMIN_2;
  const director = callAs(userId, organizationId);
  const dealId = nextUuid();
  const credentials = [{ expiresOn: create(CalendarDateSchema, { day: 12, month: 10, year: 2027 }), kind: forklift }];
  runtime.wmsStaff = [{ credentials, organizationId, userId, warehouseId, workplace: undefined }];
  const deal = create(DealSchema, {
    customerOrganizationId: SeedOrganizationId.CUSTOMER_1,
    id: dealId,
    shipFromWarehouseId: warehouseId,
    status: DealStatus.PAID,
    supplierOrganizationId: organizationId,
    version: 5,
  });
  const unitId = nextUuid();
  const sscc = '000000000000000017';
  const unit = create(StockBalanceSchema, { handlingUnit: { id: unitId, sscc, tenantId: organizationId, warehouseId } });
  const task = create(PickingTaskSchema, {
    dealId,
    id: dealId,
    requiredQualifications: [forklift, coldRoom],
    status: PickingTaskStatus.OPEN,
    units: [unit],
    version: 1,
    warehouseId,
  });
  await runtime.command((transaction) => {
    transaction.put('deals', deal);
    transaction.put('stockBalances', {
      bytes: toBinary(StockBalanceSchema, unit), id: unitId, lookupKey: buildSsccKey(organizationId, sscc), scopeId: warehouseId,
    });
    saveOutboundTask(transaction, runtime, task, organizationId, false);
  });
  const client = createClient(WarehousePickingService, transport);
  const claim = { expectedVersion: 1, idempotencyKey: nextUuid(), taskId: dealId, warehouseId };
  const denied = await captureError(client.claimPickingTask(claim, director));
  expect(readErrorDetail(denied)).toMatchObject(failureDetail(coldRoom, WarehouseStaffQualificationFailure.MISSING));
  expect(runtime.read.get('deals', dealId)).toEqual(deal);
  expect((await client.listPickingTasks({ warehouseId }, director)).tasks).toEqual([task]);
  expect(events).toHaveLength(0);
  credentials.push({ expiresOn: create(CalendarDateSchema, { day: 12, month: 10, year: 2026 }), kind: coldRoom });
  const unavailable = await captureError(client.claimPickingTask(claim, director));
  expect(readErrorDetail(unavailable)).toMatchObject({ code: ErrorCode.WAREHOUSE_EQUIPMENT_UNAVAILABLE });
  expect(runtime.read.get('deals', dealId)).toEqual(deal);
  expect((await client.listPickingTasks({ warehouseId }, director)).tasks).toEqual([task]);
  expect(events).toHaveLength(0);
  const machineId = nextUuid();
  await runtime.command((transaction) => {
    saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, {
      equipment: [{
        unit: { batteryPercent: 20, id: machineId, kind: WarehouseEquipmentKind.FORKLIFT, status: WarehouseEquipmentStatus.AVAILABLE },
        updatedAtMs: BigInt(transaction.worldTimeMs),
      }],
      stations: [{ id: nextUuid() }],
      tenantId: organizationId,
      warehouseId,
    }));
  });
  const accepted = await client.claimPickingTask(claim, director);
  expect(accepted.task).toMatchObject({ assigneeUserId: userId, version: 2 });
  expect(runtime.read.get('deals', dealId)?.status).toBe(DealStatus.PICKING);
  expect(readWarehouseEquipmentRecord(runtime.read, warehouseId)?.equipment[0]?.unit).toMatchObject({
    driverStaffId: userId, status: WarehouseEquipmentStatus.TO_TASK, taskId: dealId,
  });
  clock.now = () => Date.UTC(2026, 9, 13, 12);
  await expect(client.claimPickingTask(claim, director)).resolves.toEqual(accepted);
  await expect(client.confirmPicking({
    ...claim, expectedVersion: 2, handlingUnitIds: [unitId], idempotencyKey: nextUuid(),
  }, director)).resolves.toMatchObject({ task: { status: PickingTaskStatus.PICKED } });
  const finished = readWarehouseEquipmentRecord(runtime.read, warehouseId);
  expect(finished?.equipment[0]?.unit).toMatchObject({ batteryPercent: 0, status: WarehouseEquipmentStatus.CHARGING });
  expect(finished?.equipment[0]?.unit?.taskId).toBeUndefined();
  expect(finished?.stations[0]?.equipmentId).toBe(machineId);
});
