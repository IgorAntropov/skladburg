import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import {
  WarehouseEquipmentRecordSchema,
  type WarehouseEquipmentUnitRecord,
  WarehouseEquipmentUnitRecordSchema,
} from '@skladburg/contracts/wms/v1/warehouse_equipment_records';
import {
  expect,
  it,
} from 'vitest';

import { advanceWarehouseEquipment } from './warehouseEquipmentSimulation';

const MINUTE_MS = 60_000n;

const equipment = (
  id: string, status: WarehouseEquipmentStatus, batteryPercent: number, updatedAtMs = 0n,
): WarehouseEquipmentUnitRecord => create(WarehouseEquipmentUnitRecordSchema, {
  unit: { batteryPercent, id, kind: WarehouseEquipmentKind.FORKLIFT, status },
  updatedAtMs,
});

it('keeps twenty percent available and sends a nineteen percent unit to the station exactly once', () => {
  const record = create(WarehouseEquipmentRecordSchema, {
    equipment: [
      equipment('a', WarehouseEquipmentStatus.AVAILABLE, 20),
      equipment('b', WarehouseEquipmentStatus.AVAILABLE, 19),
      equipment('c', WarehouseEquipmentStatus.IN_REPAIR, 5),
    ],
    stations: [{ id: 'station' }],
  });
  expect(advanceWarehouseEquipment(record, 0n)).toBe(true);
  expect(record.equipment.map(entry => entry.unit?.status)).toEqual([
    WarehouseEquipmentStatus.AVAILABLE, WarehouseEquipmentStatus.CHARGING, WarehouseEquipmentStatus.IN_REPAIR,
  ]);
  expect(record.stations[0]?.equipmentId).toBe('b');
  expect(advanceWarehouseEquipment(record, MINUTE_MS - 1n)).toBe(false);
  expect(advanceWarehouseEquipment(record, MINUTE_MS)).toBe(true);
  expect(record.equipment[1]?.unit?.batteryPercent).toBe(20);
  expect(advanceWarehouseEquipment(record, 80n * MINUTE_MS)).toBe(true);
  expect(record.equipment[1]?.unit).toMatchObject({ batteryPercent: 99, status: WarehouseEquipmentStatus.CHARGING });
  expect(advanceWarehouseEquipment(record, 81n * MINUTE_MS)).toBe(true);
  expect(record.equipment[1]?.unit).toMatchObject({ batteryPercent: 100, status: WarehouseEquipmentStatus.AVAILABLE });
  expect(record.equipment[1]?.unit?.chargingStationId).toBeUndefined();
  expect(record.stations[0]?.equipmentId).toBeUndefined();
  expect(advanceWarehouseEquipment(record, 8_000n * MINUTE_MS)).toBe(false);
});

it('completes charging in queue order at the same world instants across skipped ticks and snapshot restores', () => {
  const record = create(WarehouseEquipmentRecordSchema, {
    equipment: [
      equipment('c', WarehouseEquipmentStatus.WAITING_FOR_CHARGE, 10, 2n * MINUTE_MS),
      equipment('a', WarehouseEquipmentStatus.AVAILABLE, 19),
      equipment('b', WarehouseEquipmentStatus.WAITING_FOR_CHARGE, 15, MINUTE_MS),
    ],
    stations: [{ id: 'station' }],
  });
  const jumped = clone(WarehouseEquipmentRecordSchema, record);
  advanceWarehouseEquipment(record, 2n * MINUTE_MS);
  expect(record.stations[0]?.equipmentId).toBe('a');
  expect(record.equipment[1]?.unit?.batteryPercent).toBe(21);
  for (const minute of [4, 78, 81, 99]) {
    advanceWarehouseEquipment(record, BigInt(minute) * MINUTE_MS);
  }
  expect(record.stations[0]?.equipmentId).toBe('b');
  expect(record.equipment[2]?.unit?.batteryPercent).toBe(33);
  const restored = clone(WarehouseEquipmentRecordSchema, record);
  advanceWarehouseEquipment(restored, 170n * MINUTE_MS);
  advanceWarehouseEquipment(jumped, 170n * MINUTE_MS);
  expect(jumped).toEqual(restored);
  expect(jumped.stations[0]?.equipmentId).toBe('c');
  expect(jumped.equipment[0]?.unit?.batteryPercent).toBe(14);
  expect(advanceWarehouseEquipment(jumped, 256n * MINUTE_MS)).toBe(true);
  expect(jumped.equipment.every(entry => entry.unit?.batteryPercent === 100)).toBe(true);
  expect(jumped.stations[0]?.equipmentId).toBeUndefined();
});

it('consumes whole working minutes once while retaining the driver and unfinished task below the threshold', () => {
  const record = create(WarehouseEquipmentRecordSchema, {
    equipment: [{
      unit: { batteryPercent: 21, driverStaffId: 'driver', id: 'a', status: WarehouseEquipmentStatus.HANDLING, taskId: 'work' },
      updatedAtMs: 1_500n,
    }],
    stations: [{ id: 'station' }],
  });
  expect(advanceWarehouseEquipment(record, 61_499n)).toBe(false);
  expect(advanceWarehouseEquipment(record, 121_499n)).toBe(true);
  expect(record.equipment[0]).toMatchObject({ unit: { batteryPercent: 20 }, updatedAtMs: 61_500n });
  expect(advanceWarehouseEquipment(record, 121_500n)).toBe(true);
  expect(record.equipment[0]?.unit?.batteryPercent).toBe(19);
  expect(advanceWarehouseEquipment(record, 24n * 60n * MINUTE_MS)).toBe(true);
  expect(record.equipment[0]?.unit).toMatchObject({
    batteryPercent: 0, driverStaffId: 'driver', status: WarehouseEquipmentStatus.HANDLING, taskId: 'work',
  });
  expect(record.stations[0]?.equipmentId).toBeUndefined();
});
