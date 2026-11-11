import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import { readWarehouseTopology } from './warehouseTopologyRecords';

const MAX_STOCK_REFERENCE_LENGTH = 64;

export const requireStockCells = (
  reader: IStateReader,
  errors: IDomainErrors,
  warehouseId: string,
  tenantId: string,
  ...cellIds: string[]
): void => {
  const record = reader.get('warehouseTopologies', warehouseId);

  if (record === undefined) {
    throw errors.notFound(EntityKind.WAREHOUSE_CELL);
  }

  const topology = readWarehouseTopology(record);

  if (topology.warehouseId !== warehouseId || topology.tenantId !== tenantId) {
    throw errors.internal();
  }

  const hasCells = cellIds.every(cellId => topology.storageZones.some(zone => zone.rows.some(row => row.racks.some(
    rack => rack.tiers.some(tier => tier.cells.some(cell => cell.id === cellId)),
  ))));

  if (!hasCells) {
    throw errors.notFound(EntityKind.WAREHOUSE_CELL);
  }
};

export const normalizeStockReference = (value: string, fieldPath: string, errors: IDomainErrors): string => {
  const normalized = value.normalize('NFC').trim();

  if (normalized === '') {
    throw errors.validationFailed([{ fieldPath, ruleId: 'string.min_len' }]);
  }

  if (Array.from(normalized).length > MAX_STOCK_REFERENCE_LENGTH) {
    throw errors.validationFailed([{ fieldPath, ruleId: 'string.max_len' }]);
  }

  return normalized;
};
