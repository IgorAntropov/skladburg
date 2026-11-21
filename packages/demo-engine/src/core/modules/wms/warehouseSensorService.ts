import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  GetWarehouseSensorsResponseSchema,
  WarehouseSensorService,
} from '@skladburg/contracts/wms/v1/warehouse_sensors';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { readWarehouseSensors } from './warehouseSensorSimulation';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

export const createWarehouseSensorService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseSensorService> => ({
  getWarehouseSensors: (request, context) => {
    const { errors, getWorldTimeMs, guard, read } = runtime;
    const caller = guard.guardPermissionCall(read, WarehouseSensorService.method.getWarehouseSensors, request, context.requestHeader);
    const topology = readOwnedWarehouseTopology(read, errors, request.warehouseId, caller.organizationId);
    const devices = topology === undefined ? [] : readWarehouseSensors(topology, getWorldTimeMs());
    return create(GetWarehouseSensorsResponseSchema, { devices });
  },
});

export const createWarehouseSensorHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseSensorService, createWarehouseSensorService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
