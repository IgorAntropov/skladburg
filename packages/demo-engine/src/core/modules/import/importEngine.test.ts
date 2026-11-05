import { createClient } from '@connectrpc/connect';
import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  ImportService,
  ImportStatus,
} from '@skladburg/contracts/import/v1/import';
import { performance } from 'node:perf_hooks';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IDemoEngine } from '../../engine/engineTypes';

import { createEngine } from '../../engine/createEngine';
import {
  createEngineTransport,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import { createEngineState } from '../../state/index';
import {
  nextUuid,
  SUPPLIER_1_CALL,
  SUPPLIER_2_CALL,
} from '../catalog/testing/catalogFixtures';
import {
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { buildImportXlsx } from './testing/buildImportXlsx';

const HEADERS = ['name', 'sku', 'base_unit', 'marking_mode', 'vat_rate', 'packaging_name', 'packaging_quantity',
  'gross_weight_grams', 'volume_cubic_centimeters', 'length_millimeters', 'width_millimeters', 'height_millimeters', 'sphere',
  'price_unit_name', 'price_unit_base_quantity', 'min_order_quantity', 'order_step', 'price_rub'];
const VALUES = ['Импорт', 'ENGINE-IMPORT-1', 'piece', 'none', '10', 'Короб', '12', '12500', '30000', '400', '300', '250',
  'Молочная продукция', 'шт.', '1', '10', '5', '123.45'];
const request = (): { fileBytes: Uint8Array; fileName: string; idempotencyKey: string; templateId: string } => ({
  fileBytes: new TextEncoder().encode([HEADERS, VALUES].map(row => row.join(';')).join('\n')),
  fileName: 'catalog.csv', idempotencyKey: nextUuid(), templateId: 'catalog',
});
const clientFor = (engine: IDemoEngine, isBinary = true): ReturnType<typeof createClient<typeof ImportService>> =>
  createClient(ImportService, createEngineTransport(engine, isBinary));

describe('import engine integration', () => {
  it.each([true, false])('persists jobs/provenance and idempotency across restart, isolates tenant and resets (%s)', async (isBinary) => {
    const { engine, realTime, storage } = await createTestEngine();
    const client = clientFor(engine, isBinary);
    const preview = await client.previewImport(request(), SUPPLIER_1_CALL);
    expect(preview.job?.errorCount).toBe(0);
    const commitRequest = { expectedVersion: preview.job?.version, idempotencyKey: nextUuid(), jobId: preview.job?.id };
    const committed = await client.commitImport(commitRequest, SUPPLIER_1_CALL);
    const restarted = await createEngine({ epoch: 'restart', realTime, storage });
    const restored = clientFor(restarted, isBinary);
    expect((await restored.getImportJob({ jobId: preview.job?.id }, SUPPLIER_1_CALL)).job?.status).toBe(ImportStatus.COMMITTED);
    expect((await restored.commitImport(commitRequest, SUPPLIER_1_CALL)).job).toEqual(committed.job);
    expect((await restored.listImportJobs({}, SUPPLIER_2_CALL)).jobs).toEqual([]);
    const rolledBack = await restored.rollbackImport({
      expectedVersion: committed.job?.version, idempotencyKey: nextUuid(), jobId: committed.job?.id,
    }, SUPPLIER_1_CALL);
    expect(rolledBack.job?.status).toBe(ImportStatus.ROLLED_BACK);
    const snapshot = await storage.load();
    if (snapshot === undefined) {
      throw new Error('Expected persisted snapshot');
    }
    const state = createEngineState(snapshot);
    const hasImportedProduct = state.read.listBy('products', 'tenantId', committed.job?.tenantId ?? '')
      .some(product => product.sku === 'ENGINE-IMPORT-1');
    expect(hasImportedProduct).toBe(false);
    await restarted.reset('reset');
    expect((await restored.listImportJobs({}, SUPPLIER_1_CALL)).jobs).toEqual([]);
  });
  it('previews 1000 valid XLSX rows through the binary API in less than two seconds', async () => {
    const { engine } = await createTestEngine();
    const client = clientFor(engine);
    const rows = Array.from({ length: 1000 }, (_, index) => VALUES.map((value, column) =>
      column === 1 ? `ENGINE-XLSX-${String(index)}` : value));
    const fileBytes = buildImportXlsx(HEADERS, rows);
    const start = performance.now();
    const preview = await client.previewImport({ ...request(), fileBytes, fileName: 'catalog.xlsx' }, SUPPLIER_1_CALL);
    expect(preview.job?.rowCount).toBe(1000);
    expect(preview.job?.errorCount).toBe(0);
    expect(performance.now() - start).toBeLessThan(2000);
    const detail = await client.getImportJob({ jobId: preview.job?.id }, SUPPLIER_1_CALL);
    expect(detail.rows[0]?.product?.sku).toBe('ENGINE-XLSX-0');
    expect(detail.rows[0]?.price?.tiers[0]?.price?.amountMinor).toBe(12345n);
  });
  it('commits concurrent retries once and rejects reused keys with different bytes', async () => {
    const { engine } = await createTestEngine();
    const client = clientFor(engine);
    const previewRequest = request();
    const [first, second] = await Promise.all([
      client.previewImport(previewRequest, SUPPLIER_1_CALL), client.previewImport(previewRequest, SUPPLIER_1_CALL),
    ]);
    expect(second.job).toEqual(first.job);
    const error = readErrorDetail(await captureError(client.previewImport({ ...previewRequest, fileName: 'other.csv' }, SUPPLIER_1_CALL)));
    expect(error.code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    const commitRequest = { expectedVersion: first.job?.version, idempotencyKey: nextUuid(), jobId: first.job?.id };
    const committed = await Promise.all([
      client.commitImport(commitRequest, SUPPLIER_1_CALL), client.commitImport(commitRequest, SUPPLIER_1_CALL),
    ]);
    expect(committed[0].job).toEqual(committed[1].job);
    const catalog = createClient(CatalogService, createEngineTransport(engine, true));
    expect((await catalog.listProducts({ query: 'ENGINE-IMPORT-1' }, SUPPLIER_1_CALL)).products).toHaveLength(1);
  });
  it('leaves no partial catalog rows/events after storage failure and allows retry', async () => {
    const { engine, storage } = await createTestEngine();
    const client = clientFor(engine);
    const preview = await client.previewImport(request(), SUPPLIER_1_CALL);
    const before = await storage.load();
    const commitRequest = { expectedVersion: preview.job?.version, idempotencyKey: nextUuid(), jobId: preview.job?.id };
    storage.failNextCommit();
    const error = readErrorDetail(await captureError(client.commitImport(commitRequest, SUPPLIER_1_CALL)));
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(await storage.load()).toEqual(before);
    expect((await client.getImportJob({ jobId: preview.job?.id }, SUPPLIER_1_CALL)).job?.status).toBe(ImportStatus.PREVIEW);
    expect((await client.commitImport(commitRequest, SUPPLIER_1_CALL)).job?.status).toBe(ImportStatus.COMMITTED);
  });
  it('allows a five MiB binary request to reach the bounded parser', async () => {
    const { engine } = await createTestEngine();
    const client = clientFor(engine);
    const previewRequest = request();
    const data = new Uint8Array(5 * 1024 * 1024).fill(32);
    data.set(previewRequest.fileBytes);
    const error = readErrorDetail(await captureError(client.previewImport({ ...previewRequest, fileBytes: data }, SUPPLIER_1_CALL)));
    expect(error.code).toBe(ErrorCode.IMPORT_FILE_INVALID);
    expect(error.params.case).toBe('importFileInvalid');
  });
});
