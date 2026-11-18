import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  OpenWarehouseLayoutSessionResponseSchema,
  ReleaseWarehouseLayoutSessionResponseSchema,
  RenewWarehouseLayoutSessionResponseSchema,
  WarehouseLayoutSessionService,
} from '@skladburg/contracts/wms/v1/layout_session';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import {
  assertWarehouseLayoutZonesAvailable,
  readActiveWarehouseLayoutSession,
  readWarehouseLayoutOwnerKey,
  requireOwnedWarehouseLayoutSession,
  WAREHOUSE_LAYOUT_SESSION_TTL_MS,
  warehouseLayoutSessionRecordId,
} from './warehouseLayoutSessions';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

export const createWarehouseLayoutSessionHandlers = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseLayoutSessionService> => {
  const { command, errors, generateLayoutSessionId, getRealTimeMs, guard, idempotency } = runtime;
  const { method } = WarehouseLayoutSessionService;

  return {
    openWarehouseLayoutSession: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, method.openWarehouseLayoutSession, request, context.requestHeader);
      const { organizationId: tenantId } = caller;
      const ownerKey = readWarehouseLayoutOwnerKey(caller, context.values, errors);

      return idempotency.run(transaction, {
        handler: () => {
          const { warehouseId, zoneId } = request;
          const topology = readOwnedWarehouseTopology(transaction, errors, warehouseId, tenantId);
          if (topology?.storageZones.some(zone => zone.id === zoneId) !== true) {
            throw errors.notFound(EntityKind.WAREHOUSE_STORAGE_ZONE);
          }
          assertWarehouseLayoutZonesAvailable(transaction, runtime, { tenantId, warehouseId, zoneIds: [zoneId] });
          const id = warehouseLayoutSessionRecordId({ tenantId, warehouseId, zoneId });
          const expiresAtMs = getRealTimeMs() + WAREHOUSE_LAYOUT_SESSION_TTL_MS;
          const layoutSessionId = generateLayoutSessionId();

          transaction.put('warehouseLayoutSessions', { expiresAtMs, id, layoutSessionId, ownerKey });

          return create(OpenWarehouseLayoutSessionResponseSchema, { expiresAt: timestampFromMs(expiresAtMs), layoutSessionId });
        },
        idempotencyKey: request.idempotencyKey,
        method: method.openWarehouseLayoutSession,
        request,
        scope: ownerKey,
      });
    }),
    releaseWarehouseLayoutSession: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, method.releaseWarehouseLayoutSession, request, context.requestHeader);
      const ownerKey = readWarehouseLayoutOwnerKey(caller, context.values, errors);

      return idempotency.run(transaction, {
        handler: () => {
          const scope = { tenantId: caller.organizationId, warehouseId: request.warehouseId, zoneId: request.zoneId };
          const session = readActiveWarehouseLayoutSession(transaction, scope, getRealTimeMs());
          if (session?.layoutSessionId === request.layoutSessionId && session.ownerKey === ownerKey) {
            transaction.delete('warehouseLayoutSessions', session.id);
          }

          return create(ReleaseWarehouseLayoutSessionResponseSchema);
        },
        idempotencyKey: request.idempotencyKey,
        method: method.releaseWarehouseLayoutSession,
        request,
        scope: ownerKey,
      });
    }),
    renewWarehouseLayoutSession: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, method.renewWarehouseLayoutSession, request, context.requestHeader);
      const ownerKey = readWarehouseLayoutOwnerKey(caller, context.values, errors);

      return idempotency.run(transaction, {
        handler: () => {
          const scope = { tenantId: caller.organizationId, warehouseId: request.warehouseId, zoneId: request.zoneId };
          const nowMs = getRealTimeMs();
          const session = requireOwnedWarehouseLayoutSession(
            runtime, readActiveWarehouseLayoutSession(transaction, scope, nowMs), ownerKey, request.layoutSessionId,
          );
          const expiresAtMs = nowMs + WAREHOUSE_LAYOUT_SESSION_TTL_MS;
          transaction.put('warehouseLayoutSessions', { ...session, expiresAtMs });

          return create(RenewWarehouseLayoutSessionResponseSchema, { expiresAt: timestampFromMs(expiresAtMs) });
        },
        idempotencyKey: request.idempotencyKey,
        method: method.renewWarehouseLayoutSession,
        request,
        scope: ownerKey,
      });
    }),
  };
};

export const createWarehouseLayoutSessionHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseLayoutSessionService, createWarehouseLayoutSessionHandlers(runtime));

  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
