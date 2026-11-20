import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { WarehouseStaffAreaPresence } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';

import { create } from '@bufbuild/protobuf';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import {
  GetWarehouseStaffPresenceResponseSchema,
  WarehouseStaffAreaKind,
  WarehouseStaffAreaPresenceSchema,
  WarehouseStaffPresenceService,
} from '@skladburg/contracts/wms/v1/warehouse_staff_presence';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { readInboundTask } from './inboundRecords';
import { getWarehouseShiftPlan } from './warehouseStaffShifts';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

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

const readStaffPresence = (
  runtime: IModuleRuntime, topology: WarehouseTopology, plannedByArea: ReadonlyMap<string, number> | undefined,
): WarehouseStaffAreaPresence[] => {
  const { errors, read } = runtime;
  const { receivingArea, storageZones, tenantId, warehouseId } = topology;
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

  const countByArea = new Map<string, number>();
  for (const { areaId } of latestByStaff.values()) {
    if (areaId !== undefined) {
      countByArea.set(areaId, (countByArea.get(areaId) ?? 0) + 1);
    }
  }

  const areas = storageZones.map(({ code, id }) => create(WarehouseStaffAreaPresenceSchema, {
    areaCode: code,
    areaId: id,
    kind: WarehouseStaffAreaKind.STORAGE,
    observedStaffCount: countByArea.get(id) ?? 0,
    plannedStaffCount: plannedByArea?.get(id),
  }));
  if (receivingArea !== undefined) {
    areas.unshift(create(WarehouseStaffAreaPresenceSchema, {
      areaCode: receivingArea.code,
      areaId: receivingArea.id,
      kind: WarehouseStaffAreaKind.RECEIVING,
      observedStaffCount: countByArea.get(receivingArea.id) ?? 0,
      plannedStaffCount: plannedByArea?.get(receivingArea.id),
    }));
  }

  return areas;
};

export const createWarehouseStaffPresenceService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseStaffPresenceService> => {
  const { errors, guard, read } = runtime;
  const { method } = WarehouseStaffPresenceService;

  return {
    getWarehouseStaffPresence: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.getWarehouseStaffPresence, request, context.requestHeader);
      const topology = readOwnedWarehouseTopology(read, errors, request.warehouseId, caller.organizationId);
      const assignments = runtime.wmsStaffSchedules?.get(request.warehouseId);
      const warehouse = read.get('warehouses', request.warehouseId);
      const plan = assignments !== undefined && warehouse !== undefined
        ? getWarehouseShiftPlan(assignments, runtime.getWorldTimeMs(), warehouse.timeZone)
        : undefined;
      const areas = topology === undefined ? [] : readStaffPresence(runtime, topology, plan?.plannedByArea);
      return create(GetWarehouseStaffPresenceResponseSchema, { areas, shift: plan?.shift });
    },
  };
};

export const createWarehouseStaffPresenceHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseStaffPresenceService, createWarehouseStaffPresenceService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
