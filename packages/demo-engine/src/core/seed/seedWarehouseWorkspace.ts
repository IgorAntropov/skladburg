import { create } from '@bufbuild/protobuf';
import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';
import {
  HandlingUnitKind,
  PostOpeningStockRequestSchema,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { EngineSnapshotValue } from '../ports/index';
import type { IStateReader } from '../state/index';

import {
  addCalendarDays,
  toCalendarDate,
} from '../calendar/index';
import { createDomainErrors } from '../errors/index';
import {
  applyOpeningStockPlan,
  planOpeningStock,
} from '../modules/wms/openingStockPlan';
import { buildStockBatchKey } from '../modules/wms/stockBatches';
import { buildSsccKey } from '../modules/wms/stockRecords';
import { createWarehouseTopologyRecord } from '../modules/wms/warehouseTopologyRecords';
import { createRandom } from '../ports/index';
import { createEngineState } from '../state/index';
import {
  SeedOrganizationId,
  SeedUserId,
} from './seedIds';
import { createSeedWarehouseTopology } from './seedWarehouseTopologies';
import {
  SEED_WMS_OUTBOUND_WAREHOUSE_ID,
  SEED_WMS_STOCK_DOCUMENT_NUMBER,
  SEED_WMS_TOPOLOGY_PREFIX,
} from './seedWarehouseWorkspaceConfig';

const MAX_BATCH_NUMBER_LENGTH = 64;

const allocateLots = (quantity: bigint, step: bigint): bigint[] => {
  const units: bigint[] = [];
  let remaining = quantity;
  for (let lot = step > 0n ? step : quantity; remaining > 0n; lot *= 2n) {
    const amount = lot < remaining ? lot : remaining;
    units.push(amount);
    remaining -= amount;
  }

  return units;
};

const createOpeningSscc = (sequence: number): string => {
  const body = `09${String(sequence).padStart(15, '0')}`;
  for (const digit of '0123456789') {
    const code = body + digit;
    if (hasGs1CheckDigit(code)) {
      return code;
    }
  }
  throw new Error('Failed to allocate a demo SSCC');
};

const createOpeningBatchNumber = (reader: IStateReader, tenantId: string, productId: string, sku: string): string => {
  const prefix = Array.from(sku.normalize('NFC'));
  for (let sequence = 1; ; sequence += 1) {
    const suffix = `-DEMO-WMS-${String(sequence).padStart(2, '0')}`;
    const number = prefix.slice(0, MAX_BATCH_NUMBER_LENGTH - suffix.length).join('') + suffix;
    if (reader.listBy('stockBatches', 'lookupKey', buildStockBatchKey(tenantId, productId, number)).length === 0) {
      return number;
    }
  }
};

export const seedWarehouseWorkspace = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const warehouseId = SEED_WMS_OUTBOUND_WAREHOUSE_ID;
  const tenantId = SeedOrganizationId.SUPPLIER_1;
  const state = createEngineState(snapshot);
  const warehouse = state.read.get('warehouses', warehouseId);
  if (warehouse?.tenantId !== tenantId) {
    return snapshot;
  }

  const topology = createSeedWarehouseTopology({ prefix: SEED_WMS_TOPOLOGY_PREFIX, tenantId, warehouseId });
  const cells = topology.storageZones.flatMap(zone =>
    zone.rows.flatMap(row => row.racks.flatMap(rack => rack.tiers.flatMap(tier => tier.cells))));
  const random = createRandom(snapshot.meta.randomState);
  const errors = createDomainErrors(createRandom(snapshot.meta.traceRandomState));
  const { worldTimeMs, ...meta } = snapshot.meta;
  const today = toCalendarDate(worldTimeMs, warehouse.timeZone);
  const readLiveMeta = (): typeof meta => ({ ...meta, randomState: random.getState() });
  const outcome = state.transact(worldTimeMs, (transaction) => {
    transaction.put('warehouseTopologies', createWarehouseTopologyRecord(topology));
    let sequence = 0;
    const nextSscc = (): string => {
      let sscc: string;
      do {
        sscc = createOpeningSscc(++sequence);
      } while (transaction.listBy('stockBalances', 'lookupKey', buildSsccKey(tenantId, sscc)).length > 0);
      return sscc;
    };
    const requests = transaction.listBy('listings', 'tenantId', tenantId).flatMap((listing, index) => {
      const availability = listing.availability.find(entry => entry.warehouseId === warehouseId);
      const product = transaction.get('products', listing.productId);
      const cell = cells[index % cells.length];
      if (availability === undefined || availability.quantity <= 0n || availability.status === AvailabilityStatus.ON_ORDER
        || product?.tenantId !== tenantId || cell === undefined) {
        return [];
      }

      const expiresOn = product.shelfLifeDays > 0 ? addCalendarDays(today, product.shelfLifeDays) : undefined;
      const batchNumber = createOpeningBatchNumber(transaction, tenantId, product.id, product.sku);
      return allocateLots(availability.quantity, listing.orderStep).map(quantityBase => create(PostOpeningStockRequestSchema, {
        cellId: cell.id,
        kind: HandlingUnitKind.PALLET,
        lines: [{ batchNumber, expiresOn, productId: product.id, quantityBase, status: StockStatus.AVAILABLE }],
        sourceDocumentNumber: SEED_WMS_STOCK_DOCUMENT_NUMBER,
        sscc: nextSscc(),
        warehouseId,
      }));
    });
    const plan = planOpeningStock(transaction, errors, tenantId, warehouseId, requests);
    const seedRuntime = { errors, outbox: { add: (): void => undefined }, random };
    applyOpeningStockPlan(transaction, seedRuntime, { organizationId: tenantId, user: { id: SeedUserId.ADMIN_2 } }, plan);
  }, readLiveMeta);
  const changeSet = outcome.changeSet;
  if (changeSet === undefined) {
    throw errors.internal();
  }

  const collections = { ...snapshot.collections };
  for (const name of ['warehouseTopologies', 'stockBalances', 'stockBatches', 'stockMovements'] as const) {
    collections[name] = new Map([...collections[name], ...(changeSet.puts[name] ?? [])]);
  }
  return { ...snapshot, collections, meta: changeSet.meta };
};
