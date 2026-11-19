import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  WarehouseReceivingLayoutBlockedParamsSchema,
  WarehouseReceivingLayoutBlockedReason,
} from '@skladburg/contracts/common/v1/error';
import {
  ConfigureWarehouseReceivingLayoutResponseSchema,
  WarehouseReceivingLayoutService,
} from '@skladburg/contracts/wms/v1/receiving_layout';
import {
  WarehouseReceivingAreaSchema,
  WarehouseTopologySchema,
  WarehouseUnloadingPointSchema,
} from '@skladburg/contracts/wms/v1/topology';

import type { IDomainErrors } from '../../errors/index';
import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { assignAvailableInboundDocks } from './inboundRecords';
import { readWarehouseReceivingLayoutOccupancy } from './warehouseReceivingLayoutOccupancy';
import { planWarehouseReceivingLayout } from './warehouseReceivingLayoutPlan';
import {
  readOwnedWarehouseTopology,
  saveWarehouseTopology,
} from './warehouseTopologyRecords';

const MAX_LAYOUT_REVISION = 4_294_967_295;

const rejectBlocked = (errors: IDomainErrors, reason: WarehouseReceivingLayoutBlockedReason, unloadingPointId?: string): never => {
  throw errors.create(ErrorCode.WAREHOUSE_RECEIVING_LAYOUT_BLOCKED, {
    case: 'warehouseReceivingLayoutBlocked',
    value: create(WarehouseReceivingLayoutBlockedParamsSchema, { reason, unloadingPointId }),
  });
};

const nextDockCode = (existing: Set<string>): string => {
  let number = 1;
  let code = 'D01';
  while (existing.has(code)) {
    number += 1;
    code = `D${String(number).padStart(2, '0')}`;
  }
  existing.add(code);

  return code;
};

export const createWarehouseReceivingLayoutService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseReceivingLayoutService> => {
  const { command, errors, guard, idempotency, random } = runtime;
  const { configureWarehouseReceivingLayout: method } = WarehouseReceivingLayoutService.method;
  return {
    configureWarehouseReceivingLayout: (request, context) => command((transaction) => {
      const { organizationId: tenantId } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);
      const { expectedRevision, idempotencyKey, warehouseId } = request;
      return idempotency.run(transaction, {
        handler: () => {
          const current = readOwnedWarehouseTopology(transaction, errors, warehouseId, tenantId);
          const revision = current?.revision ?? 0;
          if (revision !== expectedRevision) {
            throw errors.versionConflict(EntityKind.WAREHOUSE, revision);
          }
          if (current === undefined
            || (current.bounds === undefined && current.receivingArea === undefined && current.storageZones.length === 0)) {
            throw errors.validationFailed([{ fieldPath: 'warehouse_id', ruleId: 'warehouse.layout_not_initialized' }]);
          }
          const warehouseCapabilities = transaction.get('warehouses', warehouseId)?.capabilities ?? [];
          const plan = planWarehouseReceivingLayout(current, request, warehouseCapabilities, errors);
          if (!plan.hasChangedGeometry && plan.changedDockIds.size === 0) {
            return create(ConfigureWarehouseReceivingLayoutResponseSchema, { revision });
          }
          if (revision >= MAX_LAYOUT_REVISION) {
            throw errors.versionConflict(EntityKind.WAREHOUSE, revision);
          }
          const { hasStagedStock, hasWaitingTrucks, occupiedDockIds } = readWarehouseReceivingLayoutOccupancy(
            transaction, current, errors, plan.hasChangedFootprint,
          );
          for (const dockId of occupiedDockIds) {
            if (plan.changedDockIds.has(dockId)) {
              rejectBlocked(errors, WarehouseReceivingLayoutBlockedReason.DOCK_OCCUPIED, dockId);
            }
          }
          if (plan.hasChangedGeometry && (occupiedDockIds.size > 0 || (hasWaitingTrucks && plan.hasMovedPrimaryDock))) {
            rejectBlocked(errors, WarehouseReceivingLayoutBlockedReason.YARD_ACTIVE);
          }
          if (hasStagedStock) {
            rejectBlocked(errors, WarehouseReceivingLayoutBlockedReason.RECEIVING_AREA_OCCUPIED);
          }

          const codes = new Set(plan.docks.flatMap(({ current }) => current === undefined ? [] : [current.code]));
          const [unloadingPoint, ...additionalUnloadingPoints] = plan.docks.map(({ capabilities, current, xMm }) =>
            create(WarehouseUnloadingPointSchema, {
              capabilities,
              code: current?.code ?? nextDockCode(codes),
              id: current?.id ?? random.uuid(),
              position: { xMm, zMm: plan.facadeZMm },
            }));
          const receivingArea = create(WarehouseReceivingAreaSchema, {
            additionalUnloadingPoints,
            code: current.receivingArea?.code ?? 'PR01',
            footprint: plan.footprint,
            id: current.receivingArea?.id ?? random.uuid(),
            unloadingPoint,
          });
          const next = clone(WarehouseTopologySchema, current);
          next.revision = revision + 1;
          next.receivingArea = receivingArea;
          saveWarehouseTopology(transaction, runtime, next);
          const scope = { receivingAreaId: receivingArea.id, tenantId, warehouseId };
          assignAvailableInboundDocks(transaction, runtime, scope, undefined, occupiedDockIds);
          return create(ConfigureWarehouseReceivingLayoutResponseSchema, { revision: next.revision });
        },
        idempotencyKey,
        method,
        request,
        scope: tenantId,
      });
    }),
  };
};

export const createWarehouseReceivingLayoutHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseReceivingLayoutService, createWarehouseReceivingLayoutService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
