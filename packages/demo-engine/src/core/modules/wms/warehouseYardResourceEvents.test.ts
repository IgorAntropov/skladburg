import { create } from '@bufbuild/protobuf';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WarehouseEquipmentRecordSchema } from '@skladburg/contracts/wms/v1/warehouse_equipment_records';
import {
  expect,
  it,
} from 'vitest';

import type { TestRuntimeValue } from '../testing/testRuntime';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createTestRuntime } from '../testing/testRuntime';
import { saveInboundTask } from './inboundRecords';
import { refreshWarehouseEquipment } from './warehouseEquipmentOperations';
import { saveWarehouseEquipmentRecord } from './warehouseEquipmentRecords';
import { publishWarehouseShiftChanges } from './warehouseStaffShifts';

const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const tenantId = SeedOrganizationId.CUSTOMER_1;
const receivingAreaId = '8f000004-0000-4000-8000-000000000010';
const time = (hour: number, minute: number): number => Date.UTC(2026, 9, 12, hour, minute);

const prepareWaitingTask = async (hasForklift: boolean): Promise<TestRuntimeValue> => {
  const harness = createTestRuntime();
  const task = create(ReceivingTaskSchema, {
    dealId: 'waiting', expectedUnits: [{}], id: 'waiting', orderLines: [{}], receivingAreaId,
    requiredQualifications: hasForklift ? [WarehouseStaffQualificationKind.FORKLIFT] : [],
    status: ReceivingTaskStatus.OPEN, version: 1, warehouseId,
  });
  await harness.runtime.command((transaction) => {
    saveInboundTask(transaction, harness.runtime, task, tenantId);
  });
  harness.events.length = 0;
  return harness;
};

it('updates the task channel at break boundaries of the waiting area and skips unrelated changes', async () => {
  const { events, runtime } = await prepareWaitingTask(false);
  const channel = tasksChannel(warehouseId);
  await publishWarehouseShiftChanges(runtime, time(8, 59), time(9, 0));
  await publishWarehouseShiftChanges(runtime, time(9, 0), time(9, 1));
  await publishWarehouseShiftChanges(runtime, time(9, 29), time(9, 30));
  await publishWarehouseShiftChanges(runtime, time(9, 59), time(10, 0));
  await publishWarehouseShiftChanges(runtime, time(20, 59), time(21, 0));
  expect(events.filter(event => event.channel === channel).map(event => event.payload)).toEqual(Array.from({ length: 2 }, () => ({
    case: 'receivingTasksChanged', value: { $typeName: 'wms.v1.ReceivingTasksChanged', warehouseId },
  })));
});

it.each([
  [true, 98, 0],
  [true, 99, 1],
  [false, 99, 0],
] as const)('invalidates a forklift wait (%s) on availability and skips intermediate charge at %i percent',
  async (hasForklift, batteryPercent, expectedUpdates) => {
    const { events, runtime } = await prepareWaitingTask(hasForklift);
    await runtime.command((transaction) => {
      saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, {
        equipment: [{
          unit: {
            batteryPercent, chargingStationId: 'station', id: 'unit', kind: WarehouseEquipmentKind.FORKLIFT,
            status: WarehouseEquipmentStatus.CHARGING,
          },
          updatedAtMs: BigInt(transaction.worldTimeMs - 60_000),
        }],
        stations: [{ equipmentId: 'unit', id: 'station' }], tenantId, warehouseId,
      }));
    });
    await refreshWarehouseEquipment(runtime);
    await refreshWarehouseEquipment(runtime);
    expect(events.filter(event => event.channel === tasksChannel(warehouseId))).toHaveLength(expectedUpdates);
  });
