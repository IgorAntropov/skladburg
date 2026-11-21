import type { MessageInitShape } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import {
  type ReceivingTask,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
  WarehouseEquipmentTaskKind,
  type WarehouseEquipmentUnitSchema,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WarehouseEquipmentRecordSchema } from '@skladburg/contracts/wms/v1/warehouse_equipment_records';
import {
  expect,
  it,
} from 'vitest';

import type { IModuleRuntime } from '../moduleRuntime';

import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { addSeedWarehouseEquipment } from '../../seed/seedWarehouseEquipment';
import { addStaffAccounts } from '../../seed/seedWarehouseStaffAccess';
import { createTestRuntime } from '../testing/testRuntime';
import { saveOutboundTask } from './outboundRecords';
import {
  readWarehouseEquipmentRecord,
  saveWarehouseEquipmentRecord,
} from './warehouseEquipmentRecords';
import { readWarehouseYardResources } from './warehouseYardResources';

const tenantId = SeedOrganizationId.CUSTOMER_1;
const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const receivingAreaId = '8f000004-0000-4000-8000-000000000010';
const scope = { receivingAreaId, tenantId, warehouseId };
const lead = SeedUserId.WAREHOUSE_LEAD;
const operator = SeedUserId.WAREHOUSE_OPERATOR;
const forklift = WarehouseStaffQualificationKind.FORKLIFT;
const cold = WarehouseStaffQualificationKind.COLD_ROOM;
const now = Date.UTC(2026, 9, 14, 10);

const createWarehouse = (): IModuleRuntime => {
  const { runtime, state } = createTestRuntime();
  const snapshot = state.toSnapshot(state.getMeta());
  state.replaceAll(addSeedWarehouseEquipment(addStaffAccounts(snapshot), undefined));
  return runtime;
};

const receipt = (input: MessageInitShape<typeof ReceivingTaskSchema> = {}): ReceivingTask =>
  create(ReceivingTaskSchema, { id: 'receipt', receivingAreaId, status: ReceivingTaskStatus.OPEN, warehouseId, ...input });

const resources = (
  runtime: IModuleRuntime, tasks: readonly ReceivingTask[] = [], at = now,
): ReturnType<typeof readWarehouseYardResources> => readWarehouseYardResources(runtime.read, runtime, scope, at, tasks);

it('uses the receiving area shift in warehouse time at start, break, return and end', () => {
  const runtime = createWarehouse();
  const availableAt = (hour: number, minute: number): boolean | undefined =>
    resources(runtime, [], Date.UTC(2026, 9, 14, hour, minute))(receipt());
  expect([availableAt(4, 59), availableAt(5, 0), availableAt(9, 0), availableAt(9, 30), availableAt(14, 0)])
    .toEqual([false, true, false, true, false]);
});

it('keeps all yard resources neutral when a saved warehouse has no time zone', async () => {
  const runtime = createWarehouse();
  await runtime.command((transaction) => {
    const warehouse = transaction.get('warehouses', warehouseId);
    if (warehouse === undefined) {
      throw new Error('Missing test warehouse');
    }
    transaction.put('warehouses', { ...warehouse, timeZone: '' });
  });
  const available = resources(runtime);
  expect(available(receipt())).toBeUndefined();
  expect(available(receipt({ requiredQualifications: [forklift] }))).toBeUndefined();
});

it('uses every required qualification through the last local day and only workers in the area and organization', async () => {
  const runtime = createWarehouse();
  const qualified = receipt({ requiredQualifications: [forklift, cold] });
  expect(resources(runtime, [], Date.UTC(2026, 9, 25, 10))(qualified)).toBe(true);
  expect(resources(runtime, [], Date.UTC(2026, 9, 26, 10))(qualified)).toBe(false);
  await runtime.command((transaction) => {
    transaction.delete('memberships', SeedMembershipId.WAREHOUSE_LEAD);
  });
  expect(resources(runtime)(qualified)).toBe(false);
  expect(resources(runtime)(receipt({ requiredQualifications: [forklift] }))).toBe(true);
  expect(readWarehouseYardResources(runtime.read, runtime, { ...scope, tenantId: SeedOrganizationId.SUPPLIER_1 }, now, [])(qualified))
    .toBeUndefined();
});

it('counts work on other areas, keeps an assignee on their own receipt and distinguishes picking with the same ID', async () => {
  const runtime = createWarehouse();
  const active = receipt({ assigneeUserId: lead, status: ReceivingTaskStatus.IN_PROGRESS });
  const other = receipt({ assigneeUserId: operator, id: 'other', receivingAreaId: 'other-area', status: ReceivingTaskStatus.IN_PROGRESS });
  expect(resources(runtime, [active, other])(receipt({ id: 'next' }))).toBe(false);
  expect(resources(runtime, [active, other])(active)).toBe(true);
  const conflicting = receipt({ ...other, assigneeUserId: lead });
  expect(resources(runtime, [active, conflicting])(active)).toBe(false);
  const pick = create(PickingTaskSchema, {
    assigneeUserId: lead, dealId: active.id, id: active.id, status: PickingTaskStatus.IN_PROGRESS,
    units: [{ handlingUnit: { tenantId, warehouseId } }], warehouseId,
  });
  await runtime.command((transaction) => {
    saveOutboundTask(transaction, runtime, pick, tenantId, false);
  });
  expect(resources(runtime, [active, other])(active)).toBe(false);
  await runtime.command((transaction) => {
    saveOutboundTask(transaction, runtime, { ...pick, status: PickingTaskStatus.PICKED }, tenantId, false);
  });
  expect(resources(runtime, [active, other])(active)).toBe(true);
});

it('distinguishes a missing fleet or schedule from a known lack of usable equipment', async () => {
  const runtime = createWarehouse();
  const manual = receipt();
  const lifting = receipt({ requiredQualifications: [forklift] });
  await runtime.command((transaction) => {
    transaction.delete('warehouseEquipment', warehouseId);
  });
  expect(resources(runtime)(manual)).toBe(true);
  expect(resources(runtime)(lifting)).toBeUndefined();
  await runtime.command((transaction) => {
    saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, {
      tenantId, warehouseId,
    }));
  });
  expect(resources(runtime)(lifting)).toBe(false);
  expect(resources(runtime)(manual)).toBe(true);
  runtime.wmsStaffSchedules = new Map();
  expect(resources(runtime)(manual)).toBeUndefined();
});

it('avoids assigning an individual to an anonymous shift slot when the area is only partly staffed', () => {
  const runtime = createWarehouse();
  const first = runtime.wmsStaffSchedules?.get(warehouseId)?.find(slot => slot.areaId === receivingAreaId);
  if (first === undefined) {
    throw new Error('Missing receiving shift');
  }
  runtime.wmsStaffSchedules = new Map([[warehouseId, [
    { ...first, staffCount: 1 }, { ...first, endMinute: 23 * 60, staffCount: 1, startMinute: 17 * 60 },
  ]]]);
  expect(resources(runtime)(receipt())).toBe(true);
  expect(resources(runtime)(receipt({ requiredQualifications: [cold] }))).toBeUndefined();
});

it('keeps a drained forklift for its own receipt and driver while a free forklift alone cannot replace a claimed assignment', async () => {
  const runtime = createWarehouse();
  const active = receipt({ assigneeUserId: operator, requiredQualifications: [forklift], status: ReceivingTaskStatus.IN_PROGRESS });
  const open = receipt({ id: 'new', requiredQualifications: [forklift] });
  const base = { batteryPercent: 19, driverStaffId: operator, id: 'truck', kind: WarehouseEquipmentKind.FORKLIFT,
    status: WarehouseEquipmentStatus.HANDLING, taskId: active.id, taskKind: WarehouseEquipmentTaskKind.RECEIVING };
  const setFleet = async (unit: MessageInitShape<typeof WarehouseEquipmentUnitSchema>): Promise<void> => runtime.command((transaction) => {
    saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, {
      equipment: [{ unit, updatedAtMs: BigInt(now) }], tenantId, warehouseId,
    }));
  });
  await setFleet(base);
  expect(resources(runtime, [active])(active)).toBe(true);
  expect(resources(runtime, [active])(open)).toBe(false);
  await setFleet({ ...base, driverStaffId: lead });
  expect(resources(runtime, [active])(active)).toBe(false);
  await setFleet({ ...base, taskKind: WarehouseEquipmentTaskKind.PICKING });
  expect(resources(runtime, [active])(active)).toBe(false);
  const free = { id: base.id, kind: WarehouseEquipmentKind.FORKLIFT, status: WarehouseEquipmentStatus.AVAILABLE };
  await setFleet({ ...free, batteryPercent: 19 });
  expect(resources(runtime, [active])(open)).toBe(false);
  await setFleet({ ...free, batteryPercent: 20 });
  expect(resources(runtime, [active])(open)).toBe(true);
  expect(resources(runtime, [active])(active)).toBe(false);
  await setFleet({ ...free, batteryPercent: 100, kind: WarehouseEquipmentKind.PALLET_TRUCK });
  expect(resources(runtime, [active])(open)).toBe(false);
});

it('projects completion of charging at world time without writing the read snapshot', async () => {
  const runtime = createWarehouse();
  await runtime.command((transaction) => {
    saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, {
      equipment: [{
        unit: { batteryPercent: 99, chargingStationId: 'station', id: 'machine', kind: WarehouseEquipmentKind.FORKLIFT,
          status: WarehouseEquipmentStatus.CHARGING }, updatedAtMs: BigInt(now),
      }],
      stations: [{ equipmentId: 'machine', id: 'station' }], tenantId, warehouseId,
    }));
  });
  const task = receipt({ requiredQualifications: [forklift] });
  expect(resources(runtime, [], now + 59_999)(task)).toBe(false);
  expect(resources(runtime, [], now + 60_000)(task)).toBe(true);
  expect(readWarehouseEquipmentRecord(runtime.read, warehouseId)?.equipment[0]?.unit?.status).toBe(WarehouseEquipmentStatus.CHARGING);
});
