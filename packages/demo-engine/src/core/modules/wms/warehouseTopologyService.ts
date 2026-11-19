import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  AddWarehouseCellsResponseSchema,
  GetWarehouseTopologyResponseSchema,
  InitializeWarehouseLayoutResponseSchema,
  WarehouseTopologySchema,
  WarehouseTopologyService,
} from '@skladburg/contracts/wms/v1/topology';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { WarehouseLayoutSessionRecordValue } from '../../state/warehouseLayoutSessionRecord';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import {
  normalizeWarehouseCellCodes,
  planWarehouseCells,
} from './warehouseCellPlan';
import { collectWarehouseLayoutBoundsViolations } from './warehouseLayoutBoundsValidation';
import {
  areLayoutDraftBytesEqual,
  encodeLayoutDraftCells,
  publishWarehouseLayoutDraftChange,
} from './warehouseLayoutDrafts';
import {
  assertWarehouseLayoutZonesAvailable,
  readActiveWarehouseLayoutSession,
  readWarehouseCellZoneIds,
  readWarehouseLayoutOwnerKey,
  requireOwnedWarehouseLayoutSession,
} from './warehouseLayoutSessions';
import {
  readOwnedWarehouseTopology,
  saveWarehouseTopology,
} from './warehouseTopologyRecords';

const MAX_LAYOUT_REVISION = 4_294_967_295;

export const createWarehouseTopologyService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseTopologyService> => {
  const { command, errors, getRealTimeMs, guard, idempotency, random, read } = runtime;
  const { method } = WarehouseTopologyService;

  return {
    addWarehouseCells: (request, context) => command((transaction) => {
      const cells = request.cells.map(normalizeWarehouseCellCodes);
      const caller = guard.guardPermissionCall(transaction, method.addWarehouseCells, { ...request, cells }, context.requestHeader);
      const { layoutSessionId, warehouseId } = request;
      const { organizationId: tenantId } = caller;
      const scope = layoutSessionId === undefined ? tenantId : readWarehouseLayoutOwnerKey(caller, context.values, errors);

      return idempotency.run(transaction, {
        handler: () => {
          const current = readOwnedWarehouseTopology(transaction, errors, warehouseId, tenantId);
          const revision = current?.revision ?? 0;

          const zoneIds = readWarehouseCellZoneIds(current, cells);
          let session: undefined | WarehouseLayoutSessionRecordValue;
          if (layoutSessionId === undefined) {
            assertWarehouseLayoutZonesAvailable(transaction, runtime, { tenantId, warehouseId, zoneIds });
          }
          else {
            const [zoneId] = zoneIds;
            if (zoneId === undefined || zoneIds.size !== 1 || cells.some(cell => cell.zoneCode !== cells[0]?.zoneCode)) {
              throw errors.create(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
            }

            session = requireOwnedWarehouseLayoutSession(runtime,
              readActiveWarehouseLayoutSession(transaction, { tenantId, warehouseId, zoneId }, getRealTimeMs()), scope, layoutSessionId);
          }

          if (request.expectedRevision !== revision) {
            throw errors.versionConflict(EntityKind.WAREHOUSE, revision);
          }

          const draft = session?.draft;
          if (draft !== undefined) {
            if (draft.baseRevision !== revision) {
              throw errors.versionConflict(EntityKind.WAREHOUSE, revision);
            }
            if (!areLayoutDraftBytesEqual(draft.cellsBytes, encodeLayoutDraftCells(cells))) {
              throw errors.validationFailed([{ fieldPath: 'cells', ruleId: 'warehouse.layout_draft_mismatch' }]);
            }
          }

          const plan = planWarehouseCells(current, cells);

          if (plan.violations.length > 0) {
            throw errors.validationFailed(plan.violations.map(({ fieldPath, index, ruleId }) => ({
              fieldPath: `cells[${String(index)}].${fieldPath}`,
              ruleId,
            })));
          }

          const { topology } = plan.materialize(warehouseId, tenantId, random.uuid);
          saveWarehouseTopology(transaction, runtime, topology);
          if (session?.draft !== undefined) {
            transaction.delete('warehouseLayoutSessions', session.id);
            publishWarehouseLayoutDraftChange(runtime, transaction, warehouseId);
          }

          return create(AddWarehouseCellsResponseSchema, { revision: topology.revision });
        },
        idempotencyKey: request.idempotencyKey,
        method: method.addWarehouseCells,
        request,
        scope,
      });
    }),
    getWarehouseTopology: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.getWarehouseTopology, request, context.requestHeader);
      const topology = readOwnedWarehouseTopology(read, errors, request.warehouseId, caller.organizationId);

      return create(GetWarehouseTopologyResponseSchema, { topology });
    },
    initializeWarehouseLayout: (request, context) => command((transaction) => {
      const { initializeWarehouseLayout } = method;
      const caller = guard.guardPermissionCall(transaction, initializeWarehouseLayout, request, context.requestHeader);
      const { organizationId: tenantId } = caller;
      const { expectedRevision, idempotencyKey, warehouseDepthMm, warehouseId, warehouseWidthMm, zoneBounds } = request;

      return idempotency.run(transaction, {
        handler: () => {
          const current = readOwnedWarehouseTopology(transaction, errors, warehouseId, tenantId);
          const revision = current?.revision ?? 0;
          if (expectedRevision !== revision || revision === MAX_LAYOUT_REVISION) {
            throw errors.versionConflict(EntityKind.WAREHOUSE, revision);
          }
          const hasExistingLayout = current !== undefined
            && (current.bounds !== undefined || current.receivingArea !== undefined || current.storageZones.length > 0);
          if (hasExistingLayout) {
            throw errors.validationFailed([{ fieldPath: 'warehouse_id', ruleId: 'warehouse.layout_already_initialized' }]);
          }
          if (zoneBounds === undefined) {
            throw errors.validationFailed([{ fieldPath: 'zone_bounds', ruleId: 'required' }]);
          }
          const violations = collectWarehouseLayoutBoundsViolations(request, zoneBounds);
          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const topology = create(WarehouseTopologySchema, {
            bounds: { depthMm: warehouseDepthMm, origin: { xMm: 0, zMm: 0 }, widthMm: warehouseWidthMm },
            revision: revision + 1,
            storageZones: [{ bounds: zoneBounds, code: 'Z01', id: random.uuid(), rows: [{ code: 'R01', id: random.uuid() }] }],
            tenantId,
            warehouseId,
          });
          saveWarehouseTopology(transaction, runtime, topology);

          return create(InitializeWarehouseLayoutResponseSchema, { revision: topology.revision });
        },
        idempotencyKey,
        method: initializeWarehouseLayout,
        request,
        scope: tenantId,
      });
    }),
  };
};

export const createWarehouseTopologyHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseTopologyService, createWarehouseTopologyService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
