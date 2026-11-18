import type { ServiceImpl } from '@connectrpc/connect';
import type {
  WarehouseCellInput,
  WarehouseFloorRect,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import {
  create,
  equals,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetWarehouseLayoutDraftsResponseSchema,
  PutWarehouseLayoutDraftResponseSchema,
  WarehouseLayoutSessionService,
} from '@skladburg/contracts/wms/v1/layout_session';
import { WarehouseFloorRectSchema } from '@skladburg/contracts/wms/v1/topology';

import type { PermissionCallerValue } from '../../access/index';
import type { IDomainErrors } from '../../errors/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { readActingContext } from '../../context/index';
import {
  normalizeWarehouseCellCodes,
  normalizeWarehouseCode,
  planWarehouseCells,
} from './warehouseCellPlan';
import {
  areLayoutDraftBytesEqual,
  encodeLayoutDraftCells,
  publishWarehouseLayoutDraftChange,
} from './warehouseLayoutDrafts';
import {
  readActiveWarehouseLayoutSession,
  readWarehouseLayoutOwnerKey,
  requireOwnedWarehouseLayoutSession,
} from './warehouseLayoutSessions';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

type WarehouseLayoutDraftHandlersValue = Pick<
  ServiceImpl<typeof WarehouseLayoutSessionService>,
  'getWarehouseLayoutDrafts' | 'putWarehouseLayoutDraft'
>;

const MAX_DRAFT_REVISION = 4_294_967_295;

const requireLayoutDraftMember = (caller: PermissionCallerValue, headers: Headers, errors: IDomainErrors): void => {
  if (caller.admission.kind !== 'membership' || readActingContext(headers).supportSessionId !== undefined) {
    throw errors.membershipRequired();
  }
};

const validateLayoutDraftCells = (
  errors: IDomainErrors,
  topology: undefined | WarehouseTopology,
  zoneId: string,
  rowId: string,
  cells: readonly WarehouseCellInput[],
): WarehouseFloorRect => {
  const zone = topology?.storageZones.find(candidate => candidate.id === zoneId);
  if (zone === undefined) {
    throw errors.notFound(EntityKind.WAREHOUSE_STORAGE_ZONE);
  }

  const row = zone.rows.find(candidate => candidate.id === rowId);
  if (row === undefined) {
    throw errors.validationFailed([{ fieldPath: 'row_id', ruleId: 'warehouse.layout_draft_row' }]);
  }

  const first = cells[0];
  const footprint = first?.rackFootprint;
  const rackCode = first?.rackCode;
  const zoneCode = normalizeWarehouseCode(zone.code);
  const rowCode = normalizeWarehouseCode(row.code);
  if (footprint === undefined
    || row.racks.some(rack => normalizeWarehouseCode(rack.code) === rackCode)
    || !cells.every(cell => cell.zoneCode === zoneCode && cell.rowCode === rowCode && cell.rackCode === rackCode
      && cell.rackFootprint !== undefined && equals(WarehouseFloorRectSchema, cell.rackFootprint, footprint))) {
    throw errors.validationFailed([{ fieldPath: 'cells', ruleId: 'warehouse.layout_draft_rack' }]);
  }

  const { violations } = planWarehouseCells(topology, cells);
  if (violations.length > 0) {
    throw errors.validationFailed(violations.map(({ fieldPath, index, ruleId }) => ({
      fieldPath: `cells[${String(index)}].${fieldPath}`,
      ruleId,
    })));
  }

  return footprint;
};

export const createWarehouseLayoutDraftHandlers = (runtime: IModuleRuntime): WarehouseLayoutDraftHandlersValue => {
  const { command, errors, getRealTimeMs, guard, read } = runtime;
  const { method } = WarehouseLayoutSessionService;

  return {
    getWarehouseLayoutDrafts: (request, context) => {
      const { requestHeader } = context;
      const caller = guard.guardPermissionCall(read, method.getWarehouseLayoutDrafts, request, requestHeader);
      requireLayoutDraftMember(caller, requestHeader, errors);

      const { warehouseId } = request;
      const { organizationId: tenantId } = caller;
      const topology = readOwnedWarehouseTopology(read, errors, warehouseId, tenantId);
      const nowMs = getRealTimeMs();
      const drafts = topology?.storageZones.flatMap(({ id: zoneId }) => {
        const session = readActiveWarehouseLayoutSession(read, { tenantId, warehouseId, zoneId }, nowMs);
        if (session?.draft?.baseRevision !== topology.revision) {
          return [];
        }

        const { draft } = session;

        return [{
          baseRevision: draft.baseRevision,
          expiresAt: timestampFromMs(session.expiresAtMs),
          footprint: fromBinary(WarehouseFloorRectSchema, draft.footprintBytes),
          rowId: draft.rowId,
          zoneId,
        }];
      }) ?? [];

      return create(GetWarehouseLayoutDraftsResponseSchema, { drafts, serverTime: timestampFromMs(nowMs) });
    },
    putWarehouseLayoutDraft: (request, context) => command((transaction) => {
      const cells = request.cells.map(normalizeWarehouseCellCodes);
      const { requestHeader } = context;
      const caller = guard.guardPermissionCall(transaction, method.putWarehouseLayoutDraft, { ...request, cells }, requestHeader);
      requireLayoutDraftMember(caller, requestHeader, errors);

      const { expectedDraftRevision, expectedRevision, idempotencyKey, layoutSessionId, rowId, warehouseId, zoneId } = request;
      const { organizationId: tenantId } = caller;
      const ownerKey = readWarehouseLayoutOwnerKey(caller, context.values, errors);
      const session = requireOwnedWarehouseLayoutSession(runtime,
        readActiveWarehouseLayoutSession(transaction, { tenantId, warehouseId, zoneId }, getRealTimeMs()), ownerKey, layoutSessionId);
      const requestBytes = toBinary(method.putWarehouseLayoutDraft.input, request);
      const previous = session.draft;
      if (previous?.idempotencyKey === idempotencyKey) {
        if (!areLayoutDraftBytesEqual(previous.requestBytes, requestBytes)) {
          throw errors.idempotencyKeyReused();
        }

        return create(PutWarehouseLayoutDraftResponseSchema, { draftRevision: previous.draftRevision });
      }

      const topology = readOwnedWarehouseTopology(transaction, errors, warehouseId, tenantId);
      const baseRevision = topology?.revision ?? 0;
      if (expectedRevision !== baseRevision) {
        throw errors.versionConflict(EntityKind.WAREHOUSE, baseRevision);
      }

      const previousDraftRevision = previous?.draftRevision ?? 0;
      if (previousDraftRevision !== expectedDraftRevision || previousDraftRevision === MAX_DRAFT_REVISION) {
        throw errors.versionConflict(EntityKind.WAREHOUSE_STORAGE_ZONE, previousDraftRevision);
      }

      const footprint = validateLayoutDraftCells(errors, topology, zoneId, rowId, cells);
      const draftRevision = previousDraftRevision + 1;
      transaction.put('warehouseLayoutSessions', {
        ...session,
        draft: {
          baseRevision,
          cellsBytes: encodeLayoutDraftCells(cells),
          draftRevision,
          footprintBytes: toBinary(WarehouseFloorRectSchema, footprint, { writeUnknownFields: false }),
          idempotencyKey,
          requestBytes,
          rowId,
        },
      });
      publishWarehouseLayoutDraftChange(runtime, transaction, warehouseId);

      return create(PutWarehouseLayoutDraftResponseSchema, { draftRevision });
    }),
  };
};
