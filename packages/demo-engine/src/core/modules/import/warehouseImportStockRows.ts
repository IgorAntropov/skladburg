import type { ImportRow } from '@skladburg/contracts/import/v1/import';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import {
  HandlingUnitKind,
  type OpeningStockLine,
  OpeningStockLineSchema,
  type PostOpeningStockRequest,
  PostOpeningStockRequestSchema,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { IStateReader } from '../../state/index';
import type { WarehouseImportReferenceValue } from './warehouseImportMetadata';

import {
  addWarehouseRowError,
  readWarehouseRowValue,
} from './warehouseImportRows';

const ISO_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u;
const SIGNED_INTEGER = /^-?[0-9]{1,19}$/u;
const MAX_QUANTITY = 9_223_372_036_854_775_807n;
const MIN_QUANTITY = -9_223_372_036_854_775_808n;
const KINDS = new Map([['box', HandlingUnitKind.BOX], ['pallet', HandlingUnitKind.PALLET]]);
const STATUSES = new Map([
  ['available', StockStatus.AVAILABLE],
  ['defective', StockStatus.DEFECTIVE],
  ['quarantine', StockStatus.QUARANTINE],
]);

export interface WarehouseStockGroupValue {
  request: PostOpeningStockRequest;
  rows: ImportRow[];
}

export interface WarehouseStockRowsValue {
  groups: WarehouseStockGroupValue[];
  references: WarehouseImportReferenceValue[];
}

const mapStockLine = (row: ImportRow, columns: readonly string[], productId: string): OpeningStockLine => {
  const expires = readWarehouseRowValue(row, columns, 'expires_on');
  const match = ISO_DATE.exec(expires);
  if (expires !== '' && match === null) {
    addWarehouseRowError(row, columns, 'expires_on', 'import.calendar_date');
  }
  const status = STATUSES.get(readWarehouseRowValue(row, columns, 'status').toLowerCase());
  if (status === undefined) {
    addWarehouseRowError(row, columns, 'status', 'enum.in');
  }
  const rawQuantity = readWarehouseRowValue(row, columns, 'quantity_base');
  const quantityBase = SIGNED_INTEGER.test(rawQuantity) ? BigInt(rawQuantity) : undefined;
  if (quantityBase === undefined || quantityBase > MAX_QUANTITY || quantityBase < MIN_QUANTITY) {
    addWarehouseRowError(row, columns, 'quantity_base', 'import.integer');
  }
  return create(OpeningStockLineSchema, {
    batchNumber: readWarehouseRowValue(row, columns, 'batch_number'),
    expiresOn: match === null ? undefined : { day: Number(match[3]), month: Number(match[2]), year: Number(match[1]) },
    productId,
    quantityBase,
    status,
  });
};

interface StockRowsInputValue {
  columns: readonly string[];
  jobId: string;
  organizationId: string;
  rows: readonly ImportRow[];
  topology: undefined | WarehouseTopology;
  warehouseId: string;
}

export const mapWarehouseStockRows = (reader: IStateReader, input: StockRowsInputValue): WarehouseStockRowsValue => {
  const { columns, jobId, organizationId, rows, topology, warehouseId } = input;
  const products = new Map(reader.listBy('products', 'tenantId', organizationId).map(product => [product.sku, product]));
  const cells = new Map(topology?.storageZones.flatMap(zone => zone.rows.flatMap(row => row.racks.flatMap(
    rack => rack.tiers.flatMap(tier => tier.cells.map(cell => [cell.code, cell.id] as const)),
  ))));
  const groups = new Map<string, WarehouseStockGroupValue>();
  const references: WarehouseImportReferenceValue[] = [];

  for (const row of rows) {
    if (row.errors.length > 0) {
      continue;
    }

    const cellId = cells.get(readWarehouseRowValue(row, columns, 'cell_code'));
    const product = products.get(readWarehouseRowValue(row, columns, 'sku'));
    const kind = KINDS.get(readWarehouseRowValue(row, columns, 'kind').toLowerCase());
    const sscc = readWarehouseRowValue(row, columns, 'sscc');
    if (cellId === undefined) {
      addWarehouseRowError(row, columns, 'cell_code', 'stock.cell_not_found');
    }
    if (product === undefined) {
      addWarehouseRowError(row, columns, 'sku', 'stock.product_not_found');
    }
    if (kind === undefined) {
      addWarehouseRowError(row, columns, 'kind', 'enum.defined_only');
    }
    const line = mapStockLine(row, columns, product?.id ?? '');

    if (row.errors.length > 0 || cellId === undefined || product === undefined || kind === undefined) {
      continue;
    }

    const group = groups.get(sscc) ?? {
      request: create(PostOpeningStockRequestSchema, {
        cellId, idempotencyKey: jobId, kind, sourceDocumentNumber: `IMP-${jobId}`, sscc, warehouseId,
      }),
      rows: [],
    };
    if (group.request.cellId !== cellId || group.request.kind !== kind) {
      addWarehouseRowError(row, columns, group.request.cellId === cellId ? 'kind' : 'cell_code', 'import.handling_unit_conflict');
      continue;
    }

    group.request.lines.push(line);
    group.rows.push(row);
    groups.set(sscc, group);
    references.push({ baseUnit: product.baseUnit, cellId, productId: product.id, rowNumber: row.rowNumber });
  }

  return { groups: [...groups.values()], references };
};
