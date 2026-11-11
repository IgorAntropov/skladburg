import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  AddWarehouseCellsResponseSchema,
  GetWarehouseTopologyResponseSchema,
  WarehouseTopologyService,
} from '@skladburg/contracts/wms/v1/topology';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import {
  normalizeWarehouseCellCodes,
  planWarehouseCells,
} from './warehouseCellPlan';
import {
  readOwnedWarehouseTopology,
  saveWarehouseTopology,
} from './warehouseTopologyRecords';

export const createWarehouseTopologyService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseTopologyService> => {
  const { command, errors, guard, idempotency, random, read } = runtime;
  const { method } = WarehouseTopologyService;

  return {
    addWarehouseCells: (request, context) => command((transaction) => {
      const cells = request.cells.map(normalizeWarehouseCellCodes);
      const caller = guard.guardPermissionCall(transaction, method.addWarehouseCells, { ...request, cells }, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const { warehouseId } = request;
          const { organizationId } = caller;
          const current = readOwnedWarehouseTopology(transaction, errors, warehouseId, organizationId);
          const revision = current?.revision ?? 0;

          if (request.expectedRevision !== revision) {
            throw errors.versionConflict(EntityKind.WAREHOUSE, revision);
          }

          const plan = planWarehouseCells(current, cells);

          if (plan.violations.length > 0) {
            throw errors.validationFailed(plan.violations.map(({ fieldPath, index, ruleId }) => ({
              fieldPath: `cells[${String(index)}].${fieldPath}`,
              ruleId,
            })));
          }

          const { topology } = plan.materialize(warehouseId, organizationId, random.uuid);
          saveWarehouseTopology(transaction, runtime, topology);

          return create(AddWarehouseCellsResponseSchema, { revision: topology.revision });
        },
        idempotencyKey: request.idempotencyKey,
        method: method.addWarehouseCells,
        request,
        scope: caller.organizationId,
      });
    }),
    getWarehouseTopology: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.getWarehouseTopology, request, context.requestHeader);
      const topology = readOwnedWarehouseTopology(read, errors, request.warehouseId, caller.organizationId);

      return create(GetWarehouseTopologyResponseSchema, { topology });
    },
  };
};

export const createWarehouseTopologyHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseTopologyService, createWarehouseTopologyService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
