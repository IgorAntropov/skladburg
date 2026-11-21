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
import { readConfirmedSensorAlert } from './warehouseSensorAlerts';
import { readWarehouseSensors } from './warehouseSensorSimulation';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

export const createWarehouseSensorService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseSensorService> => ({
  getWarehouseSensors: (request, context) => {
    const { errors, getWorldTimeMs, guard, read } = runtime;
    const caller = guard.guardPermissionCall(read, WarehouseSensorService.method.getWarehouseSensors, request, context.requestHeader);
    const topology = readOwnedWarehouseTopology(read, errors, request.warehouseId, caller.organizationId);
    const devices = topology === undefined ? [] : readWarehouseSensors(topology, getWorldTimeMs());
    for (const device of devices) {
      for (const channel of device.channels) {
        const record = read.get('warehouseSensorAlerts', channel.id);
        channel.alert = readConfirmedSensorAlert(errors, record, caller.organizationId, request.warehouseId, device.zoneId);
      }
    }
    return create(GetWarehouseSensorsResponseSchema, { devices });
  },
});

export const createWarehouseSensorHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseSensorService, createWarehouseSensorService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
