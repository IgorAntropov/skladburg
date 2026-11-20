import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';

import type { IModuleRuntime } from '../moduleRuntime';

import { readInboundTask } from './inboundRecords';

interface StaffObservationValue {
  areaId: string | undefined;
  at: Timestamp;
}

const compareObservationTimes = (current: Timestamp, prev: Timestamp): number => {
  if (current.seconds === prev.seconds) {
    return current.nanos - prev.nanos;
  }

  return current.seconds < prev.seconds ? -1 : 1;
};

const indexStorageZones = (topology: WarehouseTopology): ReadonlyMap<string, string> => {
  const zoneByCell = new Map<string, string>();
  for (const zone of topology.storageZones) {
    for (const row of zone.rows) {
      for (const rack of row.racks) {
        for (const tier of rack.tiers) {
          for (const cell of tier.cells) {
            zoneByCell.set(cell.id, zone.id);
          }
        }
      }
    }
  }

  return zoneByCell;
};

const mergeStaffObservation = (current: StaffObservationValue, prev: StaffObservationValue | undefined): StaffObservationValue => {
  if (prev === undefined) {
    return current;
  }

  const order = compareObservationTimes(current.at, prev.at);
  if (order === 0 && current.areaId !== prev.areaId) {
    return { areaId: undefined, at: current.at };
  }

  return order > 0 ? current : prev;
};

export const readStaffObservations = (runtime: IModuleRuntime, topology: WarehouseTopology): ReadonlyMap<string, StaffObservationValue> => {
  const { errors, read } = runtime;
  const { receivingArea, tenantId, warehouseId } = topology;
  const zoneByCell = indexStorageZones(topology);
  const members = new Set(read.listBy('memberships', 'organizationId', tenantId).map(membership => membership.userId));
  const latestByStaff = new Map<string, StaffObservationValue>();

  for (const record of read.listBy('warehouseInbound', 'scopeId', warehouseId)) {
    if (record.lookupKey !== tenantId) {
      continue;
    }

    const task = readInboundTask(record, errors);
    const { assigneeUserId, receivedUnits, status } = task;
    if (status !== ReceivingTaskStatus.IN_PROGRESS || assigneeUserId === undefined || !members.has(assigneeUserId)) {
      continue;
    }

    const receivingAreaId = receivingArea?.id === task.receivingAreaId ? receivingArea.id : undefined;
    for (const { putAwayAt, putAwayCellId, receivedAt } of receivedUnits) {
      const isPutAwayLatest = putAwayAt !== undefined
        && (receivedAt === undefined || compareObservationTimes(putAwayAt, receivedAt) >= 0);
      const at = isPutAwayLatest ? putAwayAt : receivedAt;
      if (at === undefined) {
        continue;
      }

      const areaId = isPutAwayLatest ? zoneByCell.get(putAwayCellId ?? '') : receivingAreaId;
      latestByStaff.set(assigneeUserId, mergeStaffObservation({ areaId, at }, latestByStaff.get(assigneeUserId)));
    }
  }

  return latestByStaff;
};
