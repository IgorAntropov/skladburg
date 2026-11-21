import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  GetWarehouseEquipmentResponseSchema,
  WarehouseEquipmentService,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import { isWarehouseInScope } from '../../access/permissionScope';
import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { readWarehouseEquipmentRecord } from './warehouseEquipmentRecords';
import { readVisibleStaff } from './warehouseStaffVisibility';

export const createWarehouseEquipmentService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseEquipmentService> => ({
  getWarehouseEquipment: (request, context) => {
    const { errors, guard, read } = runtime;
    const { warehouseId } = request;
    const caller = guard.guardPermissionCall(read, WarehouseEquipmentService.method.getWarehouseEquipment, request, context.requestHeader);
    const record = readWarehouseEquipmentRecord(read, warehouseId);
    if (record === undefined) {
      return create(GetWarehouseEquipmentResponseSchema);
    }
    if (record.tenantId !== caller.organizationId) {
      throw errors.internal();
    }

    const hasPermission = (name: string): boolean =>
      caller.permissions.some(grant => grant.permission === name && isWarehouseInScope(grant, warehouseId));
    const canReadTasks = hasPermission('task_view');
    const canReadDrivers = caller.admission.kind === 'membership' && hasPermission('staff_profile_view');
    const drivers = canReadDrivers && record.equipment.some(({ unit }) => unit?.driverStaffId !== undefined)
      ? new Set(readVisibleStaff(runtime, caller, warehouseId).filter(member => member.canReadWork).map(({ member }) => member.userId))
      : undefined;
    const equipment = record.equipment.map(({ unit }) => {
      if (unit === undefined) {
        throw errors.internal();
      }
      return {
        ...unit,
        driverStaffId: unit.driverStaffId !== undefined && drivers?.has(unit.driverStaffId) ? unit.driverStaffId : undefined,
        taskId: canReadTasks ? unit.taskId : undefined,
        taskKind: canReadTasks ? unit.taskKind : undefined,
      };
    });
    return create(GetWarehouseEquipmentResponseSchema, { equipment, stations: record.stations });
  },
});

export const createWarehouseEquipmentHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseEquipmentService, createWarehouseEquipmentService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
