import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import { readWarehouseTopology } from './warehouseTopologyCodec';

const MAX_STOCK_REFERENCE_LENGTH = 64;

export const findMissingStockCellIds = (
  reader: IStateReader,
  errors: IDomainErrors,
  warehouseId: string,
  tenantId: string,
  cellIds: readonly string[],
): ReadonlySet<string> => {
  const missing = new Set(cellIds);
  if (missing.size === 0) {
    return missing;
  }

  const record = reader.get('warehouseTopologies', warehouseId);

  if (record === undefined) {
    return missing;
  }

  const topology = readWarehouseTopology(record);

  if (topology.warehouseId !== warehouseId || topology.tenantId !== tenantId) {
    throw errors.internal();
  }

  for (const zone of topology.storageZones) {
    for (const row of zone.rows) {
      for (const rack of row.racks) {
        for (const tier of rack.tiers) {
          for (const cell of tier.cells) {
            if (missing.delete(cell.id) && missing.size === 0) {
              return missing;
            }
          }
        }
      }
    }
  }

  return missing;
};

export const requireStockCells = (
  reader: IStateReader,
  errors: IDomainErrors,
  warehouseId: string,
  tenantId: string,
  cellId: string,
  ...otherCellIds: string[]
): void => {
  if (findMissingStockCellIds(reader, errors, warehouseId, tenantId, [cellId, ...otherCellIds]).size > 0) {
    throw errors.notFound(EntityKind.WAREHOUSE_CELL);
  }
};

type StockReferenceValue = { ruleId: string } | { value: string };

export const prepareStockReference = (value: string): StockReferenceValue => {
  const normalized = value.normalize('NFC').trim();

  if (normalized === '') {
    return { ruleId: 'string.min_len' };
  }

  if (Array.from(normalized).length > MAX_STOCK_REFERENCE_LENGTH) {
    return { ruleId: 'string.max_len' };
  }

  return { value: normalized };
};

export const normalizeStockReference = (value: string, fieldPath: string, errors: IDomainErrors): string => {
  const prepared = prepareStockReference(value);

  if ('ruleId' in prepared) {
    throw errors.validationFailed([{ fieldPath, ruleId: prepared.ruleId }]);
  }

  return prepared.value;
};
