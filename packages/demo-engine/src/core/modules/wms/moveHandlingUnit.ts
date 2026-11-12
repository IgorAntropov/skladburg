import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type MoveHandlingUnitRequest,
  type MoveHandlingUnitResponse,
  MoveHandlingUnitResponseSchema,
  StockMovementKind,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  normalizeStockReference,
  requireStockCells,
} from './stockLocations';
import {
  readStockBalance,
  recordStockMovement,
} from './stockRecords';

const MAX_HANDLING_UNIT_VERSION = 2_147_483_647;

export const moveHandlingUnit = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  request: MoveHandlingUnitRequest,
): MoveHandlingUnitResponse => {
  const { errors } = runtime;
  const { expectedVersion, handlingUnitId, toCellId, warehouseId } = request;
  const record = transaction.get('stockBalances', handlingUnitId);

  if (record?.scopeId !== warehouseId) {
    throw errors.notFound(EntityKind.HANDLING_UNIT);
  }

  const balance = readStockBalance(record, caller.organizationId, errors);
  if (balance.lines.length === 0) {
    throw errors.notFound(EntityKind.HANDLING_UNIT);
  }

  if (balance.receivingAreaId !== undefined) {
    throw errors.invalidTransition(EntityKind.HANDLING_UNIT, 'RECEIVING_AREA', 'TRANSFER');
  }
  if (balance.lines.some(line => line.status === StockStatus.RESERVED)) {
    throw errors.invalidTransition(EntityKind.HANDLING_UNIT, StockStatus[StockStatus.RESERVED], 'TRANSFER');
  }

  const { handlingUnit } = balance;

  if (handlingUnit === undefined || handlingUnit.version >= MAX_HANDLING_UNIT_VERSION) {
    throw errors.internal();
  }

  if (handlingUnit.version !== expectedVersion) {
    throw errors.versionConflict(EntityKind.HANDLING_UNIT, handlingUnit.version);
  }

  const fromCellId = balance.cellId;
  if (toCellId === fromCellId) {
    throw errors.validationFailed([{ fieldPath: 'to_cell_id', ruleId: 'stock.same_cell' }]);
  }

  requireStockCells(transaction, errors, warehouseId, caller.organizationId, fromCellId, toCellId);
  const sourceDocumentNumber = normalizeStockReference(request.sourceDocumentNumber, 'source_document_number', errors);

  balance.cellId = toCellId;
  handlingUnit.version += 1;
  const movement = recordStockMovement(transaction, runtime, caller.user.id, balance, {
    fromCellId,
    kind: StockMovementKind.TRANSFER,
    sourceDocumentNumber,
  });

  return create(MoveHandlingUnitResponseSchema, { balance, movement });
};
