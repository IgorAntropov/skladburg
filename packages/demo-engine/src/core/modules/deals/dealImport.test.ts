import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';
import { SaveListingRequestSchema } from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  CreateDealDraftRequestSchema,
  DealService,
} from '@skladburg/contracts/deal/v1/deal';
import {
  ImportService,
  ImportStatus,
} from '@skladburg/contracts/import/v1/import';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedCityId,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/index';
import { createEngineState } from '../../state/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildAvailability,
  captureFailure,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import { createModuleHarness } from '../testing/moduleHarness';

const createImportedDealFixture = async (): Promise<{
  harness: ReturnType<typeof createModuleHarness>;
  importClient: ReturnType<typeof createClient<typeof ImportService>>;
  jobId: string;
  jobVersion: bigint;
  request: ReturnType<typeof create<typeof CreateDealDraftRequestSchema>>;
}> => {
  const harness = createModuleHarness();
  const importClient = createClient(ImportService, harness.transport);
  const headers = ['name', 'sku', 'base_unit', 'marking_mode', 'vat_rate', 'packaging_name', 'packaging_quantity',
    'gross_weight_grams', 'volume_cubic_centimeters', 'length_millimeters', 'width_millimeters', 'height_millimeters', 'sphere',
    'price_unit_name', 'price_unit_base_quantity', 'min_order_quantity', 'order_step', 'price_rub'];
  const values = ['Поставка', 'DEAL-IMPORT-1', 'piece', 'none', '10', 'Короб', '12', '12500', '30000', '400', '300', '250',
    'Молочная продукция', 'шт.', '1', '10', '5', '123.45'];
  const preview = await importClient.previewImport({
    fileBytes: new TextEncoder().encode([headers, values].map(row => row.join(';')).join('\n')),
    fileName: 'catalog.csv', idempotencyKey: nextUuid(), templateId: 'catalog',
  }, SUPPLIER_1_CALL);
  const committed = await importClient.commitImport({ expectedVersion: preview.job?.version,
    idempotencyKey: nextUuid(),
    jobId: preview.job?.id },
  SUPPLIER_1_CALL);
  const jobId = committed.job?.id ?? '';
  const listing = (await importClient.getImportJob({ jobId }, SUPPLIER_1_CALL)).rows[0]?.listing;
  if (listing === undefined) {
    throw new Error('Missing imported listing');
  }
  const saved = await harness.catalog.saveListing(create(SaveListingRequestSchema, {
    availability: [buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1)],
    expectedVersion: listing.version, idempotencyKey: nextUuid(), listingId: listing.id,
    minOrderQuantity: listing.minOrderQuantity, orderStep: listing.orderStep,
    priceUnit: listing.priceUnit, productId: listing.productId, sphereIds: listing.sphereIds,
  }), SUPPLIER_1_CALL);
  await harness.catalog.setListingPublished({ expectedVersion: saved.listing?.version,
    idempotencyKey: nextUuid(),
    isPublished: true,
    listingId: listing.id },
  SUPPLIER_1_CALL);
  return {
    harness, importClient, jobId, jobVersion: committed.job?.version ?? 0n,
    request: create(CreateDealDraftRequestSchema, {
      dealId: nextUuid(), desiredDate: { day: 20, month: 10, year: 2026 }, idempotencyKey: nextUuid(),
      lines: [{ listingId: listing.id, quantity: 10n }], shipFromCityId: SeedCityId.KRASNODAR,
      shipToWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1, supplierOrganizationId: SeedOrganizationId.SUPPLIER_1,
    }),
  };
};

describe('deal usage of imported listings', () => {
  it('marks actual draft usage permanently and blocks rollback even after private cancellation', async () => {
    const { harness, importClient, jobId, jobVersion, request } = await createImportedDealFixture();
    harness.events.length = 0;
    await harness.deal.createDealDraft(request, CUSTOMER_CALL);
    expect(harness.state.read.get('importJobs', jobId)?.usedListingIds).toEqual([request.lines[0]?.listingId]);
    await harness.deal.cancelDeal({ dealId: request.dealId,
      expectedVersion: 1,
      idempotencyKey: nextUuid(),
      reason: 'Отмена' },
    CUSTOMER_CALL);
    expect((await captureFailure(importClient.rollbackImport({ expectedVersion: jobVersion,
      idempotencyKey: nextUuid(),
      jobId },
    SUPPLIER_1_CALL))).code).toBe(ErrorCode.IMPORT_ROLLBACK_BLOCKED);
    expect(harness.state.read.get('importJobs', jobId)?.job.status).toBe(ImportStatus.COMMITTED);
    expect(harness.events.filter(event => event.channel.includes(SeedOrganizationId.SUPPLIER_1))).toHaveLength(0);
  });

  it('does not mark imported listings when the deal commit fails', async () => {
    const { harness, jobId, request } = await createImportedDealFixture();
    const initial = await harness.storage.load();
    if (initial === undefined) {
      throw new Error('Missing fixture snapshot');
    }
    const { engine, storage } = await createTestEngine({ storage: createSpyStorage(initial) });
    const client = createClient(DealService, createEngineTransport(engine, true));
    storage.failNextCommit();
    expect((await captureFailure(client.createDealDraft(request, CUSTOMER_CALL))).code).toBe(ErrorCode.UNAVAILABLE);
    const snapshot = await storage.load();
    if (snapshot === undefined) {
      throw new Error('Missing persisted snapshot');
    }
    const state = createEngineState(snapshot);
    expect(state.read.get('importJobs', jobId)?.usedListingIds).toEqual([]);
    expect(state.read.list('deals')).toHaveLength(0);
    expect(state.read.list('productLinks')).toHaveLength(0);
    expect(state.read.list('supplyContracts')).toHaveLength(0);
    expect(snapshot.collections.products.size).toBe(initial.collections.products.size);
  });
});
