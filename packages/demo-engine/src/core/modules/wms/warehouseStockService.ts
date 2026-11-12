import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import {
  ListStockBalancesResponseSchema,
  ListStockMovementsResponseSchema,
  WarehouseStockService,
} from '@skladburg/contracts/wms/v1/stock';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { compareIds } from '../../state/index';
import { paginate } from '../pagination';
import {
  readStockBalance,
  readStockMovement,
} from './stockRecords';

export const createWarehouseStockService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseStockService> => {
  const { command, errors, guard, idempotency, read } = runtime;
  const { method } = WarehouseStockService;

  return {
    listStockBalances: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.listStockBalances, request, context.requestHeader);
      const active = read.listBy('stockBalances', 'scopeId', request.warehouseId)
        .map(record => ({ balance: readStockBalance(record, caller.organizationId, errors), id: record.id }))
        .filter(({ balance }) => balance.lines.length > 0);
      const { items, page } = paginate(active, record => record.id, request.page, errors);

      return create(ListStockBalancesResponseSchema, { balances: items.map(({ balance }) => balance), page });
    },
    listStockMovements: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.listStockMovements, request, context.requestHeader);
      const records = read.listBy('stockMovements', 'scopeId', request.warehouseId).sort(
        (current, prev) => Number(prev.lookupKey) - Number(current.lookupKey) || compareIds(current.id, prev.id),
      );
      const { items, page } = paginate(records, record => record.id, request.page, errors);
      const movements = items.map(record => readStockMovement(record, caller.organizationId, errors));

      return create(ListStockMovementsResponseSchema, { movements, page });
    },
    moveHandlingUnit: async (request, context) => {
      const { moveHandlingUnit } = await import('./moveHandlingUnit');
      return command((transaction) => {
        const caller = guard.guardPermissionCall(transaction, method.moveHandlingUnit, request, context.requestHeader);

        return idempotency.run(transaction, {
          handler: () => moveHandlingUnit(transaction, runtime, caller, request),
          idempotencyKey: request.idempotencyKey,
          method: method.moveHandlingUnit,
          request,
          scope: caller.organizationId,
        });
      });
    },
    postOpeningStock: async (request, context) => {
      const { postOpeningStock } = await import('./postOpeningStock');
      return command((transaction) => {
        const caller = guard.guardPermissionCall(transaction, method.postOpeningStock, request, context.requestHeader);

        return idempotency.run(transaction, {
          handler: () => postOpeningStock(transaction, runtime, caller, request),
          idempotencyKey: request.idempotencyKey,
          method: method.postOpeningStock,
          request,
          scope: caller.organizationId,
        });
      });
    },
  };
};

export const createWarehouseStockHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseStockService, createWarehouseStockService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
