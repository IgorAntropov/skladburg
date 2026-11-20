import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { WarehouseStaffAreaPresence } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';

import { create } from '@bufbuild/protobuf';
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
import { readStaffObservations } from './warehouseStaffObservations';
import { getWarehouseShiftPlan } from './warehouseStaffShifts';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

const readStaffPresence = (
  runtime: IModuleRuntime, topology: WarehouseTopology, plannedByArea: ReadonlyMap<string, number> | undefined,
): WarehouseStaffAreaPresence[] => {
  const { receivingArea, storageZones } = topology;
  const latestByStaff = readStaffObservations(runtime, topology);
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
