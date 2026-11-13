import type { Page } from '@playwright/test';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { HandlingUnitKind } from '@skladburg/contracts/wms/v1/stock';
import { randomUUID } from 'node:crypto';

import { readStoredEngineSnapshot } from './engine-storage-robot.ts';

const DATABASE_NAME = 'skladburg-demo-engine';
const PRE_SETTLEMENT_SCHEMA_VERSION = 23;
const RECEIVING_AREA_ID = '8f000002-0000-4000-8000-000000000010';

export const RECEIPT_SSCC = '000000000000000017';
export const RECEIPT_CELL_ID = '8f000002-0000-4000-8000-000000000006';

const readLinkedProduct = async (page: Page, deal: Deal, supplierProductId: string): Promise<string> => {
  const snapshot: unknown = JSON.parse(await readStoredEngineSnapshot(page, ['productLinks']));
  if (!Array.isArray(snapshot) || !Array.isArray(snapshot[0]) || !Array.isArray(snapshot[0][2])) {
    throw new TypeError('Expected the stored product links');
  }

  const links: unknown[] = snapshot[0][2];
  const link = links.find(candidate =>
    typeof candidate === 'object' && candidate !== null
    && 'customerOrganizationId' in candidate && candidate.customerOrganizationId === deal.customerOrganizationId
    && 'supplierOrganizationId' in candidate && candidate.supplierOrganizationId === deal.supplierOrganizationId
    && 'supplierProductId' in candidate && candidate.supplierProductId === supplierProductId,
  );
  if (typeof link !== 'object' || link === null || !('customerProductId' in link) || typeof link.customerProductId !== 'string') {
    throw new Error('The agreed deal must have a linked customer product');
  }

  return link.customerProductId;
};

export const seedLegacyWarehouseReceipt = async (page: Page, deal: Deal, supplierProductId: string): Promise<void> => {
  const [line] = deal.lines;
  if (line?.productSnapshot === undefined) {
    throw new Error('Expected the frozen deal line');
  }
  const product = line.productSnapshot;
  const productId = await readLinkedProduct(page, deal, supplierProductId);
  const { customerOrganizationId, id, shipToWarehouseId } = deal;
  const task = create(ReceivingTaskSchema, {
    dealId: id,
    expectedUnits: [{
      batches: [{ batchNumber: 'RECEIPT-1', dealLineId: line.id, quantityBase: line.quantity }],
      id: randomUUID(),
      kind: HandlingUnitKind.PALLET,
      sscc: RECEIPT_SSCC,
    }],
    id,
    orderLines: [{
      baseUnit: product.baseUnit,
      dealLineId: line.id,
      gtin: product.gtin,
      productId,
      productName: product.name,
      quantityBase: line.quantity,
    }],
    receivingAreaId: RECEIVING_AREA_ID,
    sourceDocumentNumber: 'UPD-RECEIPT-1',
    status: ReceivingTaskStatus.OPEN,
    version: 1,
    warehouseId: shipToWarehouseId,
  });

  await page.evaluate(async ({ bytes, databaseName, id, lookupKey, schemaVersion, scopeId }): Promise<void> => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = (): void => {
        resolve(request.result);
      };
      request.onerror = (): void => {
        reject(request.error ?? new Error('IndexedDB request failed'));
      };
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(['meta', 'warehouseInbound'], 'readwrite');
        transaction.oncomplete = (): void => {
          resolve();
        };
        transaction.onabort = (): void => {
          reject(transaction.error ?? new Error('Could not seed the stored receiving task'));
        };
        transaction.objectStore('meta').put(schemaVersion, 'schemaVersion');
        transaction.objectStore('warehouseInbound').put({ bytes: Uint8Array.from(bytes), id, lookupKey, scopeId }, id);
      });
    }
    finally {
      database.close();
    }
  }, {
    bytes: Array.from(toBinary(ReceivingTaskSchema, task)),
    databaseName: DATABASE_NAME,
    id,
    lookupKey: customerOrganizationId,
    schemaVersion: PRE_SETTLEMENT_SCHEMA_VERSION,
    scopeId: shipToWarehouseId,
  });
};
