import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import {
  GetWarehouseTopologyResponseSchema,
  WarehouseTopologyService,
} from '@skladburg/contracts/wms/v1/topology';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { readWarehouseTopology } from './warehouseTopologyRecords';

export const createWarehouseTopologyService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseTopologyService> => ({
  getWarehouseTopology: (request, context) => {
    const { errors, guard, read } = runtime;
    const caller = guard.guardPermissionCall(read, WarehouseTopologyService.method.getWarehouseTopology, request, context.requestHeader);
    const record = read.get('warehouseTopologies', request.warehouseId);

    if (record === undefined) {
      return create(GetWarehouseTopologyResponseSchema);
    }

    const topology = readWarehouseTopology(record);

    if (topology.warehouseId !== request.warehouseId || topology.tenantId !== caller.organizationId) {
      throw errors.internal();
    }

    return create(GetWarehouseTopologyResponseSchema, { topology });
  },
});

export const createWarehouseTopologyHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseTopologyService, createWarehouseTopologyService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
