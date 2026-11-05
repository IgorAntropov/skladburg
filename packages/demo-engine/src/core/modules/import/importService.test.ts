import { create } from '@bufbuild/protobuf';
import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { ListingPriceSchema } from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  ImportService,
  ImportStatus,
} from '@skladburg/contracts/import/v1/import';
import { getContractRegistry } from '@skladburg/contracts/registry';
import { SUPPORT_SESSION_HEADER } from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import { performance } from 'node:perf_hooks';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import { createRequestValidator } from '../../validation/index';
import {
  buildListingRequest,
  buildProductRequest,
  createEmptyCatalogHarness,
  nextUuid,
  SUPPLIER_1_CALL,
  SUPPLIER_2_CALL,
} from '../catalog/testing/catalogFixtures';
import { putSession } from '../platform/testing/supportAccessFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createImportService } from './importService';
import * as xlsxReader from './xlsxReader';

export const HEADERS = ['name', 'sku', 'base_unit', 'marking_mode', 'vat_rate', 'packaging_name', 'packaging_quantity',
  'gross_weight_grams', 'volume_cubic_centimeters', 'length_millimeters', 'width_millimeters', 'height_millimeters', 'sphere',
  'price_unit_name', 'price_unit_base_quantity', 'min_order_quantity', 'order_step', 'price_rub'];
export const VALUES = ['Импортированный товар', 'IMPORT-001', 'piece', 'none', '10', 'Короб', '12', '12500', '30000', '400', '300', '250',
  'Молочная продукция', 'шт.', '1', '10', '5', '123.45'];
const file = (rows: readonly (readonly string[])[]): Uint8Array =>
  new TextEncoder().encode([HEADERS, ...rows].map(row => row.join(';')).join('\n'));
interface ImportHarnessValue {
  client: ReturnType<typeof createClient<typeof ImportService>>;
  harness: Awaited<ReturnType<typeof createEmptyCatalogHarness>>;
}

const setup = async (): Promise<ImportHarnessValue> => {
  const harness = await createEmptyCatalogHarness();
  const service = createImportService(harness.runtime, createRequestValidator(harness.runtime.errors, getContractRegistry()));
  const client = createClient(ImportService, createRouterTransport(router => router.service(ImportService, service)));
  return { client, harness };
};
interface ImportRequestValue {
  fileBytes: Uint8Array;
  fileName: string;
  idempotencyKey: string;
  templateId: string;
}

const request = (rows: readonly (readonly string[])[] = [VALUES]): ImportRequestValue => ({
  fileBytes: file(rows), fileName: 'catalog.csv', idempotencyKey: nextUuid(), templateId: 'catalog',
});

describe('catalog import', () => {
  it('previews, creates only private drafts and rolls back atomically without resurrecting idempotent data', async () => {
    const { client, harness } = await setup();
    const previewRequest = request();
    const preview = await client.previewImport(previewRequest, SUPPLIER_1_CALL);
    const job = preview.job;
    expect(job?.status).toBe(ImportStatus.PREVIEW);
    expect(job?.errorCount).toBe(0);
    expect(harness.runtime.read.list('products')).toHaveLength(0);
    const detail = await client.getImportJob({ jobId: job?.id }, SUPPLIER_1_CALL);
    expect(detail.rows[0]?.price?.tiers[0]?.price?.amountMinor).toBe(12345n);
    const commitRequest = { expectedVersion: job?.version, idempotencyKey: nextUuid(), jobId: job?.id };
    const committed = await client.commitImport(commitRequest, SUPPLIER_1_CALL);
    expect(committed.job?.status).toBe(ImportStatus.COMMITTED);
    expect(harness.runtime.read.list('products')).toHaveLength(1);
    expect(harness.runtime.read.list('listings')[0]).toMatchObject({ availability: [], isPublished: false, version: 1n });
    const rolledBack = await client.rollbackImport({
      expectedVersion: committed.job?.version, idempotencyKey: nextUuid(), jobId: job?.id,
    }, SUPPLIER_1_CALL);
    expect(rolledBack.job?.status).toBe(ImportStatus.ROLLED_BACK);
    expect(harness.runtime.read.list('products')).toHaveLength(0);
    expect(harness.runtime.read.list('priceLists')).toHaveLength(0);
    expect((await client.commitImport(commitRequest, SUPPLIER_1_CALL)).job?.status).toBe(ImportStatus.COMMITTED);
    expect((await client.previewImport(previewRequest, SUPPLIER_1_CALL)).job?.status).toBe(ImportStatus.PREVIEW);
    expect(harness.runtime.read.list('products')).toHaveLength(0);
  });
  it('validates all rows and repeats catalog validation at commit', async () => {
    const { client, harness } = await setup();
    const preview = await client.previewImport(request([VALUES, VALUES]), SUPPLIER_1_CALL);
    expect(preview.job?.errorCount).toBeGreaterThan(0);
    const duplicate = await client.getImportJob({ hasErrorsOnly: true, jobId: preview.job?.id }, SUPPLIER_1_CALL);
    expect(duplicate.rows[0]?.errors.some(error => error.ruleId === 'catalog.sku_taken')).toBe(true);
    const valid = await client.previewImport(request(), SUPPLIER_1_CALL);
    await harness.catalog.saveProduct(buildProductRequest({ sku: VALUES[1] }), SUPPLIER_1_CALL);
    const detail = readErrorDetail(await captureError(client.commitImport({
      expectedVersion: valid.job?.version, idempotencyKey: nextUuid(), jobId: valid.job?.id,
    }, SUPPLIER_1_CALL)));
    expect(detail.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(harness.runtime.read.list('listings')).toHaveLength(0);
  });
  it('denies extra catalog permissions before parsing malformed bytes and isolates tenants', async () => {
    const { client, harness } = await setup();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.SUPPLIER_1, permissions: ['import_create'], warehouseIds: [],
    });
    const denied = readErrorDetail(await captureError(client.previewImport({
      ...request(), fileBytes: new Uint8Array([1]), fileName: 'bad.xlsx',
    }, callAs(userId, SeedOrganizationId.SUPPLIER_1))));
    expect(denied.code).toBe(ErrorCode.PERMISSION_DENIED);
    const preview = await client.previewImport(request(), SUPPLIER_1_CALL);
    const foreign = readErrorDetail(await captureError(client.getImportJob({ jobId: preview.job?.id }, SUPPLIER_2_CALL)));
    expect(foreign.code).toBe(ErrorCode.NOT_FOUND);
  });
  it('blocks rollback after persisted use', async () => {
    const { client, harness } = await setup();
    const preview = await client.previewImport(request(), SUPPLIER_1_CALL);
    const committed = await client.commitImport({
      expectedVersion: preview.job?.version, idempotencyKey: nextUuid(), jobId: preview.job?.id,
    }, SUPPLIER_1_CALL);
    const jobId = committed.job?.id ?? '';
    await harness.runtime.command((transaction) => {
      const record = transaction.get('importJobs', jobId);
      if (record !== undefined) {
        record.usedListingIds.push(record.provenance[0]?.listingId ?? '');
        transaction.put('importJobs', record);
      }
    });
    const error = readErrorDetail(await captureError(client.rollbackImport({
      expectedVersion: committed.job?.version, idempotencyKey: nextUuid(), jobId,
    }, SUPPLIER_1_CALL)));
    expect(error.code).toBe(ErrorCode.IMPORT_ROLLBACK_BLOCKED);
    expect(harness.runtime.read.list('products')).toHaveLength(1);
  });
  it('runs the full 1000-row Preview below two seconds and paginates rows at 100', async () => {
    const { client } = await setup();
    const rows = Array.from({ length: 1000 }, (_, index) => VALUES.map((value, column) => column === 1 ? `SKU-${String(index)}` : value));
    const start = performance.now();
    const preview = await client.previewImport(request(rows), SUPPLIER_1_CALL);
    expect(preview.job?.errorCount).toBe(0);
    expect(performance.now() - start).toBeLessThan(2000);
    const detail = await client.getImportJob({ jobId: preview.job?.id, page: { pageSize: 200 } }, SUPPLIER_1_CALL);
    expect(detail.rows).toHaveLength(100);
    expect(detail.page?.nextPageToken).not.toBe('');
  });
  it('reports original source columns with reordered headers and omitted optional fields', async () => {
    const { client } = await setup();
    const headers = [...HEADERS].reverse();
    const values = [...VALUES].reverse();
    const sourceIndex = headers.indexOf('min_order_quantity');
    values[sourceIndex] = '11';
    const fileBytes = new TextEncoder().encode([headers, values].map(row => row.join(';')).join('\n'));
    const preview = await client.previewImport({ ...request(), fileBytes }, SUPPLIER_1_CALL);
    const detail = await client.getImportJob({ jobId: preview.job?.id }, SUPPLIER_1_CALL);
    expect(detail.rows[0]?.errors).toEqual(expect.arrayContaining([expect.objectContaining({
      columnNumber: sourceIndex + 1, fieldPath: 'min_order_quantity', rowNumber: 2, ruleId: 'catalog.min_order_not_multiple_of_step',
    })]));
  });

  const rollbackChangeKinds = ['product', 'listing', 'price', 'priceList', 'externalPrice'];
  it.each(rollbackChangeKinds)('blocks rollback after %s changes with no partial deletes', async (kind) => {
    const { client, harness } = await setup();
    const preview = await client.previewImport(request(), SUPPLIER_1_CALL);
    const committed = await client.commitImport({
      expectedVersion: preview.job?.version, idempotencyKey: nextUuid(), jobId: preview.job?.id,
    }, SUPPLIER_1_CALL);
    await harness.runtime.command((transaction) => {
      const record = transaction.get('importJobs', committed.job?.id ?? '');
      const provenance = record?.provenance[0];
      if (record === undefined || provenance === undefined) {
        throw new Error('Expected committed provenance');
      }
      if (kind === 'product') {
        const product = transaction.get('products', provenance.productId);
        if (product !== undefined) {
          product.version += 2n;
          transaction.put('products', product);
        }
      }
      if (kind === 'listing') {
        const listing = transaction.get('listings', provenance.listingId);
        if (listing !== undefined) {
          listing.version += 2n;
          transaction.put('listings', listing);
        }
      }
      if (kind === 'price') {
        const price = transaction.get('listingPrices', provenance.listingId);
        if (price !== undefined) {
          price.version += 2n;
          transaction.put('listingPrices', price);
        }
      }
      if (kind === 'priceList') {
        const priceList = transaction.get('priceLists', record.createdPriceListId);
        if (priceList !== undefined) {
          priceList.version += 2n;
          transaction.put('priceLists', priceList);
        }
      }
      if (kind === 'externalPrice') {
        transaction.put('listingPrices', create(ListingPriceSchema, {
          listingId: nextUuid(), priceListId: record.createdPriceListId, tenantId: record.job.tenantId, version: 1n,
        }));
      }
    });
    const error = readErrorDetail(await captureError(client.rollbackImport({
      expectedVersion: committed.job?.version, idempotencyKey: nextUuid(), jobId: committed.job?.id,
    }, SUPPLIER_1_CALL)));
    expect(error.code).toBe(ErrorCode.IMPORT_ROLLBACK_BLOCKED);
    expect(harness.runtime.read.list('products')).toHaveLength(1);
    expect(harness.runtime.read.list('listings')).toHaveLength(1);
  });
  it('requires fresh rights after asynchronous reading and on commit', async () => {
    const { client, harness } = await setup();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.SUPPLIER_1,
      permissions: ['import_create', 'import_view', 'catalog_edit', 'catalog_view', 'price_list_edit', 'price_list_view'],
      warehouseIds: [],
    });
    const call = callAs(userId, SeedOrganizationId.SUPPLIER_1);
    const original = await client.previewImport(request(), call);
    const spy = vi.spyOn(xlsxReader, 'readXlsx').mockImplementationOnce(async () => {
      await harness.runtime.command((transaction) => {
        const membership = transaction.listBy('memberships', 'userId', userId)[0];
        const role = transaction.get('roles', membership?.roleAssignments[0]?.roleId ?? '');
        if (role !== undefined) {
          role.permissions = role.permissions.filter(permission => permission !== 'catalog_edit');
          transaction.put('roles', role);
        }
      });
      return [HEADERS, VALUES];
    });
    const denied = readErrorDetail(await captureError(client.previewImport({ ...request(), fileName: 'catalog.xlsx' }, call)));
    spy.mockRestore();
    expect(denied.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(harness.runtime.read.list('importJobs')).toHaveLength(1);
    const commitDenied = readErrorDetail(await captureError(client.commitImport({
      expectedVersion: original.job?.version, idempotencyKey: nextUuid(), jobId: original.job?.id,
    }, call)));
    expect(commitDenied.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(harness.runtime.read.list('products')).toHaveLength(0);
  });
  it('lets CATALOG EDIT support import and keeps manual catalog writes closed', async () => {
    const { client, harness } = await setup();
    const sessionId = nextUuid();
    await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS + 3600000, id: sessionId, mode: SupportAccessMode.EDIT,
      organizationId: SeedOrganizationId.SUPPLIER_1, section: SupportAccessSection.CATALOG, status: SupportAccessStatus.ACTIVE,
    });
    const headers = new Headers(callAs(SeedUserId.OPERATOR_SUPPORT_ENGINEER, SeedOrganizationId.SUPPLIER_1).headers);
    headers.set(SUPPORT_SESSION_HEADER, sessionId);
    const preview = await client.previewImport(request(), { headers });
    expect(preview.job?.errorCount).toBe(0);
    const committed = await client.commitImport({
      expectedVersion: preview.job?.version, idempotencyKey: nextUuid(), jobId: preview.job?.id,
    }, { headers });
    expect(committed.job?.status).toBe(ImportStatus.COMMITTED);
    expect(readErrorDetail(await captureError(harness.catalog.saveProduct(buildProductRequest(), { headers }))).code)
      .toBe(ErrorCode.PERMISSION_DENIED);
    await harness.runtime.command((transaction) => {
      const session = transaction.get('supportAccessSessions', sessionId);
      if (session !== undefined) {
        session.mode = SupportAccessMode.VIEW;
        transaction.put('supportAccessSessions', session);
      }
    });
    expect(readErrorDetail(await captureError(client.rollbackImport({
      expectedVersion: committed.job?.version, idempotencyKey: nextUuid(), jobId: committed.job?.id,
    }, { headers }))).code).toBe(ErrorCode.PERMISSION_DENIED);
  });
  const occupiedIdKinds = ['product', 'foreignProduct', 'listing', 'foreignListing', 'price'];
  it.each(occupiedIdKinds)('rejects occupied preview IDs for %s without overwriting', async (kind) => {
    const { client, harness } = await setup();
    const preview = await client.previewImport(request(), SUPPLIER_1_CALL);
    const detail = await client.getImportJob({ jobId: preview.job?.id }, SUPPLIER_1_CALL);
    const row = detail.rows[0];
    const call = kind.startsWith('foreign') ? SUPPLIER_2_CALL : SUPPLIER_1_CALL;
    if (kind === 'product' || kind === 'foreignProduct') {
      await harness.catalog.saveProduct(buildProductRequest({ productId: row?.product?.id, sku: 'ID-COLLISION' }), call);
    }
    else if (kind === 'listing' || kind === 'foreignListing') {
      const product = await harness.catalog.saveProduct(buildProductRequest({ sku: 'LISTING-COLLISION' }), call);
      await harness.catalog.saveListing(buildListingRequest(product.product?.id ?? '', {
        availability: [], listingId: row?.listing?.id,
      }), call);
    }
    else {
      await harness.runtime.command((transaction) => {
        transaction.put('listingPrices', create(ListingPriceSchema, {
          listingId: row?.listing?.id, priceListId: nextUuid(), tenantId: SeedOrganizationId.SUPPLIER_2, version: 7n,
        }));
      });
    }
    const before = await harness.storage.load();
    const error = readErrorDetail(await captureError(client.commitImport({
      expectedVersion: preview.job?.version, idempotencyKey: nextUuid(), jobId: preview.job?.id,
    }, SUPPLIER_1_CALL)));
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(await harness.storage.load()).toEqual(before);
  });
});
