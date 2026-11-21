import type {
  WarehouseChargingStation,
  WarehouseEquipmentUnit,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import type {
  WarehouseEquipmentRecord,
  WarehouseEquipmentUnitRecord,
} from '@skladburg/contracts/wms/v1/warehouse_equipment_records';

import { WarehouseEquipmentStatus } from '@skladburg/contracts/wms/v1/warehouse_equipment';

import { compareIds } from '../../state/table';

export const MINIMUM_WORK_BATTERY_PERCENT = 20;
const FULL_BATTERY_PERCENT = 100;
const MINUTE_MS = 60_000n;

type EquipmentWithUnitValue = WarehouseEquipmentUnitRecord & { unit: WarehouseEquipmentUnit };

const hasUnit = (entry: WarehouseEquipmentUnitRecord): entry is EquipmentWithUnitValue => entry.unit !== undefined;

const elapsedPercent = (entry: WarehouseEquipmentUnitRecord, nowMs: bigint, limit: number): number => {
  const elapsed = (nowMs - entry.updatedAtMs) / MINUTE_MS;
  return elapsed > 0n ? Number(elapsed > BigInt(limit) ? BigInt(limit) : elapsed) : 0;
};

const chargeAtStation = (
  entry: EquipmentWithUnitValue, station: WarehouseChargingStation, nowMs: bigint, freedAtMs: Map<string, bigint>,
): boolean => {
  const { unit } = entry;
  const added = elapsedPercent(entry, nowMs, FULL_BATTERY_PERCENT - unit.batteryPercent);
  unit.batteryPercent += added;
  entry.updatedAtMs += BigInt(added) * MINUTE_MS;
  if (unit.batteryPercent === FULL_BATTERY_PERCENT) {
    unit.status = WarehouseEquipmentStatus.AVAILABLE;
    unit.chargingStationId = undefined;
    station.equipmentId = undefined;
    freedAtMs.set(station.id, entry.updatedAtMs);
    return true;
  }
  return added > 0;
};

const compareTimes = (current: bigint, prev: bigint): number => current < prev ? -1 : Number(current > prev);

export const advanceWarehouseEquipment = (record: WarehouseEquipmentRecord, nowMs: bigint): boolean => {
  let hasChanges = false;
  const waiting: EquipmentWithUnitValue[] = [];
  const freedAtMs = new Map<string, bigint>();
  for (const entry of record.equipment.filter(hasUnit)) {
    const { unit } = entry;
    if (unit.status === WarehouseEquipmentStatus.CHARGING) {
      const station = record.stations.find(candidate => candidate.id === unit.chargingStationId && candidate.equipmentId === unit.id);
      if (station !== undefined && chargeAtStation(entry, station, nowMs, freedAtMs)) {
        hasChanges = true;
      }
    }
    else if (unit.status === WarehouseEquipmentStatus.TO_TASK || unit.status === WarehouseEquipmentStatus.HANDLING
      || unit.status === WarehouseEquipmentStatus.CARRYING) {
      const spent = elapsedPercent(entry, nowMs, unit.batteryPercent);
      if (spent > 0) {
        unit.batteryPercent -= spent;
        entry.updatedAtMs += BigInt(spent) * MINUTE_MS;
        hasChanges = true;
      }
    }
    else if (unit.status === WarehouseEquipmentStatus.WAITING_FOR_CHARGE
      || (unit.status === WarehouseEquipmentStatus.AVAILABLE && unit.batteryPercent < MINIMUM_WORK_BATTERY_PERCENT)) {
      if (unit.status === WarehouseEquipmentStatus.AVAILABLE) {
        unit.status = WarehouseEquipmentStatus.WAITING_FOR_CHARGE;
        hasChanges = true;
      }
      waiting.push(entry);
    }
  }

  waiting.sort((current, prev) => compareTimes(current.updatedAtMs, prev.updatedAtMs) || compareIds(current.unit.id, prev.unit.id));
  for (const entry of waiting) {
    const { unit } = entry;
    const available = record.stations.filter(station => station.equipmentId === undefined);
    const startAt = (station: WarehouseChargingStation): bigint => {
      const freed = freedAtMs.get(station.id);
      return freed === undefined || freed < entry.updatedAtMs ? entry.updatedAtMs : freed;
    };
    const station = available.sort((current, prev) => compareTimes(startAt(current), startAt(prev)) || compareIds(current.id, prev.id))[0];
    if (station === undefined) {
      break;
    }
    entry.updatedAtMs = startAt(station);
    unit.status = WarehouseEquipmentStatus.CHARGING;
    unit.chargingStationId = station.id;
    station.equipmentId = unit.id;
    chargeAtStation(entry, station, nowMs, freedAtMs);
    hasChanges = true;
  }
  return hasChanges;
};
