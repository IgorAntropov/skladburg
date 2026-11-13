import { fromBinary } from '@bufbuild/protobuf';
import {
  StockMovementKind,
  StockMovementSchema,
} from '@skladburg/contracts/wms/v1/stock';

import type { EngineSnapshotValue } from '../ports/index';

import { TABLE_DEFINITIONS } from '../state/index';
import {
  SEED_WMS_OUTBOUND_WAREHOUSE_ID,
  SEED_WMS_STOCK_DOCUMENT_NUMBER,
  SEED_WMS_TOPOLOGY_PREFIX,
} from './seedWarehouseWorkspaceConfig';

export const hasSeedWarehouseStock = (snapshot: EngineSnapshotValue): boolean => {
  for (const stored of snapshot.collections.stockMovements.values()) {
    const { bytes, scopeId } = TABLE_DEFINITIONS.stockMovements.decode(stored);
    if (scopeId === SEED_WMS_OUTBOUND_WAREHOUSE_ID) {
      const { kind, sourceDocumentNumber, toCellId } = fromBinary(StockMovementSchema, bytes);
      if (kind === StockMovementKind.OPENING_BALANCE && sourceDocumentNumber === SEED_WMS_STOCK_DOCUMENT_NUMBER
        && toCellId.startsWith(`${SEED_WMS_TOPOLOGY_PREFIX}-0000-4000-8000-`)) {
        return true;
      }
    }
  }

  return false;
};
