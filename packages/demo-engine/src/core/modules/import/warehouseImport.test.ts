import { createClient } from '@connectrpc/connect';
import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  ImportService,
  ImportStatus,
} from '@skladburg/contracts/import/v1/import';
import {
  HandlingUnitKind,
  StockStatus,
  WarehouseStockService,
} from '@skladburg/contracts/wms/v1/stock';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import {
  strFromU8,
  strToU8,
  unzipSync,
  zipSync,
} from 'fflate';
import { readFileSync } from 'node:fs';
import {
  expect,
  it,
} from 'vitest';

import {
  createEngineTransport,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import {
  buildProductRequest,
  nextUuid,
} from '../catalog/testing/catalogFixtures';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { buildImportXlsx } from './testing/buildImportXlsx';

const CUSTOMER = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const STOREKEEPER = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
const CELLS = { templateId: 'warehouse_cells', warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 };
const STOCK = { ...CELLS, templateId: 'opening_stock' };

it('keeps catalog and both warehouse templates distinct and enforces warehouse scope', async () => {
  const { engine } = await createTestEngine();
  const client = createClient(ImportService, createEngineTransport(engine, true));

  const cells = await client.getImportTemplate({ warehouseScope: CELLS }, CUSTOMER);
  expect(cells.template?.id).toBe(CELLS.templateId);
  expect(cells.template?.columns.map(column => column.key)).toContain('tier_elevation_mm');
  const stock = await client.getImportTemplate({ warehouseScope: STOCK }, CUSTOMER);
  expect(stock.template?.id).toBe(STOCK.templateId);
  expect(stock.template?.columns.map(column => column.key)).toContain('quantity_base');

  const foreign = { ...STOCK, warehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1 };
  expect(readErrorDetail(await captureError(client.getImportTemplate({ warehouseScope: foreign }, CUSTOMER))).code)
    .toBe(ErrorCode.NOT_FOUND);
  const outOfScope = { ...STOCK, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2 };
  expect(readErrorDetail(await captureError(client.getImportTemplate({ warehouseScope: outOfScope }, STOREKEEPER))).code)
    .toBe(ErrorCode.PERMISSION_DENIED);
});

const CELL_HEADERS = [
  'zone_code', 'row_code', 'rack_code', 'rack_x_mm', 'rack_z_mm', 'rack_width_mm', 'rack_depth_mm',
  'tier_code', 'tier_elevation_mm', 'cell_code', 'x_offset_mm', 'width_mm',
];
const STOCK_HEADERS = ['cell_code', 'sku', 'batch_number', 'expires_on', 'sscc', 'kind', 'status', 'quantity_base'];
const NEW_CELL_CODE = 'Z01-R01-S01-Y03-C01';
const CELL_ROW = ['Z01', 'R01', 'S01', '4000', '1000', '1200', '1000', 'Y03', '3000', NEW_CELL_CODE, '0', '600'];
const SUPPLIER = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
const SUPPLIER_WAREHOUSE = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;

it('posts stock to the exact SKU and applies the shared batch normalization', async () => {
  const { engine } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const catalog = createClient(CatalogService, transport);
  const imports = createClient(ImportService, transport);
  const stock = createClient(WarehouseStockService, transport);
  const warehouseScope = { ...STOCK, warehouseId: SUPPLIER_WAREHOUSE };
  await catalog.saveProduct(buildProductRequest({ sku: 'EXACT-SKU' }), SUPPLIER);
  const { product } = await catalog.saveProduct(buildProductRequest({ sku: 'EXACT-SKU ' }), SUPPLIER);
  const fileBytes = buildImportXlsx(STOCK_HEADERS, [[
    'Z01-R01-S01-Y01-C01', 'EXACT-SKU ', 'LOT-1 ', '', '000000000000000017', 'pallet', 'available', '1',
  ]]);
  const { job } = await imports.previewImport({ fileBytes, fileName: 'stock.xlsx', idempotencyKey: nextUuid(), warehouseScope }, SUPPLIER);
  expect(job?.errorCount).toBe(0);
  await imports.commitImport({
    expectedVersion: job?.version, idempotencyKey: nextUuid(), jobId: job?.id, warehouseScope,
  }, SUPPLIER);
  const { movements } = await stock.listStockMovements({ warehouseId: SUPPLIER_WAREHOUSE }, SUPPLIER);
  expect(movements[0]?.lines[0]?.batch).toMatchObject({ number: 'LOT-1', productId: product?.id });
});

it('reports coerced dates, broken formulas and extra columns without posting any stock', async () => {
  const { engine } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const imports = createClient(ImportService, transport);
  const stock = createClient(WarehouseStockService, transport);
  const { products } = await createClient(CatalogService, transport).listProducts({}, SUPPLIER);
  const warehouseScope = { ...STOCK, warehouseId: SUPPLIER_WAREHOUSE };
  const cellCode = 'Z01-R01-S01-Y01-C01';
  const sku = products[0]?.sku ?? '';
  const archive = unzipSync(buildImportXlsx(STOCK_HEADERS, [
    [cellCode, sku, '1-2', '', '000000000000000017', 'pallet', 'available', '1'],
    [cellCode, sku, 'LOT-2', '', '000000000000000024', 'pallet', 'available', '1'],
    [cellCode, sku, 'LOT-3', '', '000000000000000031', 'pallet', 'available', '1', 'extra'],
    [cellCode, sku, 'LOT-4', '', '000000000000000048', 'pallet', 'available', '1'],
  ]));
  const path = 'xl/worksheets/sheet1.xml';
  const source = archive[path];
  if (source === undefined) {
    throw new Error('Missing sheet fixture');
  }
  archive[path] = strToU8(strFromU8(source)
    .replace('<c r="C2" t="inlineStr"><is><t>1-2</t></is></c>', '<c r="C2" t="d"><v>2026-01-02T00:00:00Z</v></c>')
    .replace('<c r="D3" t="inlineStr"><is><t></t></is></c>', '<c r="D3" t="e"><f>1/0</f><v>#DIV/0!</v></c>')
    .replace('<c r="D4" t="inlineStr"><is><t></t></is></c>', '<c r="D4" t="str"><f>TEXT(TODAY(), "yyyy-mm-dd")</f></c>')
    .replace('<c r="D5" t="inlineStr"><is><t></t></is></c>', '<c r="D5" t="str"><f>""</f><v/></c>'));
  const { job } = await imports.previewImport({
    fileBytes: zipSync(archive), fileName: 'stock.xlsx', idempotencyKey: nextUuid(), warehouseScope,
  }, SUPPLIER);
  const { rows } = await imports.getImportJob({ hasErrorsOnly: true, jobId: job?.id, warehouseScope }, SUPPLIER);
  expect(rows.flatMap(row => row.errors)).toEqual(expect.arrayContaining([
    expect.objectContaining({ columnNumber: 3, fieldPath: 'batch_number', rowNumber: 2, ruleId: 'import.excel_text_required' }),
    expect.objectContaining({ columnNumber: 4, fieldPath: 'expires_on', rowNumber: 3, ruleId: 'import.excel_cell_error' }),
    expect.objectContaining({ columnNumber: 4, fieldPath: 'expires_on', rowNumber: 4, ruleId: 'import.excel_cell_error' }),
    expect.objectContaining({ columnNumber: 9, fieldPath: 'rows', rowNumber: 4, ruleId: 'import.extra_column' }),
  ]));
  expect(rows.map(row => row.rowNumber)).toEqual([2, 3, 4]);
  expect(readErrorDetail(await captureError(imports.commitImport({
    expectedVersion: job?.version, idempotencyKey: nextUuid(), jobId: job?.id, warehouseScope,
  }, SUPPLIER))).code).toBe(ErrorCode.VALIDATION_FAILED);
  expect((await stock.listStockMovements({ warehouseId: SUPPLIER_WAREHOUSE }, SUPPLIER)).movements).toEqual([]);
});

it('previews and applies one workbook to a new layout, then safely rolls it back after restart', async () => {
  const { engine, storage } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const client = createClient(ImportService, transport);
  const topology = createClient(WarehouseTopologyService, transport);
  const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2;
  const warehouseScope = { ...CELLS, warehouseId };
  const fileBytes = buildImportXlsx(CELL_HEADERS, [CELL_ROW]);
  const preview = await client.previewImport({ fileBytes, fileName: 'cells.xlsx', idempotencyKey: nextUuid(), warehouseScope }, CUSTOMER);
  expect(preview.job).toMatchObject({ errorCount: 0, rowCount: 1, status: ImportStatus.PREVIEW, warehouseId });
  expect((await topology.getWarehouseTopology({ warehouseId }, CUSTOMER)).topology).toBeUndefined();

  const jobId = preview.job?.id ?? '';
  expect((await client.listImportJobs({ warehouseScope }, CUSTOMER)).jobs.map(job => job.id)).toEqual([jobId]);
  expect((await client.listImportJobs({ warehouseScope: CELLS }, CUSTOMER)).jobs).toEqual([]);
  expect(readErrorDetail(await captureError(client.getImportJob({ jobId, warehouseScope: CELLS }, CUSTOMER))).code)
    .toBe(ErrorCode.NOT_FOUND);
  expect(readErrorDetail(await captureError(client.getImportJob({ jobId, warehouseScope: { ...STOCK, warehouseId } }, CUSTOMER))).code)
    .toBe(ErrorCode.NOT_FOUND);

  const commit = { expectedVersion: preview.job?.version, idempotencyKey: nextUuid(), jobId, warehouseScope };
  const applied = await client.commitImport(commit, CUSTOMER);
  expect(applied.job?.status).toBe(ImportStatus.COMMITTED);
  expect(await client.commitImport(commit, CUSTOMER)).toEqual(applied);
  const created = (await topology.getWarehouseTopology({ warehouseId }, CUSTOMER)).topology;
  expect(created?.revision).toBe(1);
  expect(created?.storageZones[0]?.rows[0]?.racks[0]?.tiers[0]?.cells[0]?.code).toBe(NEW_CELL_CODE);

  const reopened = await createTestEngine({ storage });
  const reopenedTransport = createEngineTransport(reopened.engine, true);
  const rollback = await createClient(ImportService, reopenedTransport).rollbackImport({
    expectedVersion: applied.job?.version, idempotencyKey: nextUuid(), jobId, warehouseScope,
  }, CUSTOMER);
  expect(rollback.job?.status).toBe(ImportStatus.ROLLED_BACK);
  expect((await createClient(WarehouseTopologyService, reopenedTransport).getWarehouseTopology({ warehouseId }, CUSTOMER)).topology)
    .toMatchObject({ revision: 2, storageZones: [] });
});

it('retains physical row numbers and writes no layout if the last row overlaps', async () => {
  const { engine } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const client = createClient(ImportService, transport);
  const topology = createClient(WarehouseTopologyService, transport);
  const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2;
  const warehouseScope = { ...CELLS, warehouseId };
  const overlap = CELL_ROW.map((value, index) => index === 9 ? 'Z01-R01-S01-Y03-C02' : value);
  const fileBytes = buildImportXlsx(CELL_HEADERS, [CELL_ROW, [], overlap]);
  const { job } = await client.previewImport({ fileBytes, fileName: 'cells.xlsx', idempotencyKey: nextUuid(), warehouseScope }, CUSTOMER);
  expect(job?.errorCount).toBeGreaterThan(0);
  const { rows } = await client.getImportJob({ hasErrorsOnly: true, jobId: job?.id, warehouseScope }, CUSTOMER);
  expect(rows.map(row => row.rowNumber)).toContain(4);
  expect(readErrorDetail(await captureError(client.commitImport({
    expectedVersion: job?.version, idempotencyKey: nextUuid(), jobId: job?.id, warehouseScope,
  }, CUSTOMER))).code).toBe(ErrorCode.VALIDATION_FAILED);
  expect((await topology.getWarehouseTopology({ warehouseId }, CUSTOMER)).topology).toBeUndefined();
});

it('commits multiple stock units with exact quantities, retains one journal, and blocks both destructive rollbacks', async () => {
  const { engine, storage } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const imports = createClient(ImportService, transport);
  const topology = createClient(WarehouseTopologyService, transport);
  const stock = createClient(WarehouseStockService, transport);
  const cellsScope = { ...CELLS, warehouseId: SUPPLIER_WAREHOUSE };
  const warehouseScope = { ...STOCK, warehouseId: SUPPLIER_WAREHOUSE };
  const cellsPreview = await imports.previewImport({
    fileBytes: buildImportXlsx(CELL_HEADERS, [CELL_ROW]), fileName: 'cells.xlsx', idempotencyKey: nextUuid(), warehouseScope: cellsScope,
  }, SUPPLIER);
  const cellsJob = (await imports.commitImport({
    expectedVersion: cellsPreview.job?.version, idempotencyKey: nextUuid(), jobId: cellsPreview.job?.id, warehouseScope: cellsScope,
  }, SUPPLIER)).job;
  expect(cellsJob?.status).toBe(ImportStatus.COMMITTED);
  const { products } = await createClient(CatalogService, transport).listProducts({}, SUPPLIER);
  const sku = products[0]?.sku ?? '';
  const fileBytes = buildImportXlsx(STOCK_HEADERS, [
    [NEW_CELL_CODE, sku, 'LOT-1', '2028-02-29', '000000000000000017', 'pallet', 'available', '9007199254740993'],
    [NEW_CELL_CODE, sku, 'LOT-2', '', '000000000000000017', 'pallet', 'quarantine', '2'],
    ['Z01-R01-S01-Y01-C01', sku, 'LOT-3', '', '000000000000000024', 'box', 'defective', '1'],
  ]);
  const { job } = await imports.previewImport({
    fileBytes, fileName: 'stock.xlsx', idempotencyKey: nextUuid(), warehouseScope,
  }, SUPPLIER);
  expect(job).toMatchObject({ errorCount: 0, rowCount: 3, status: ImportStatus.PREVIEW });
  const query = { warehouseId: SUPPLIER_WAREHOUSE };
  expect((await stock.listStockMovements(query, SUPPLIER)).movements).toEqual([]);

  const commit = { expectedVersion: job?.version, idempotencyKey: nextUuid(), jobId: job?.id, warehouseScope };
  storage.failNextCommit();
  expect(readErrorDetail(await captureError(imports.commitImport(commit, SUPPLIER))).code).toBe(ErrorCode.UNAVAILABLE);
  expect((await stock.listStockBalances(query, SUPPLIER)).balances).toEqual([]);
  expect((await stock.listStockMovements(query, SUPPLIER)).movements).toEqual([]);

  const { job: applied } = await imports.commitImport(commit, SUPPLIER);
  expect(applied?.status).toBe(ImportStatus.COMMITTED);
  expect((await imports.commitImport(commit, SUPPLIER)).job).toEqual(applied);
  const { movements } = await stock.listStockMovements(query, SUPPLIER);
  expect(movements).toHaveLength(2);
  expect(movements.every(move => move.sourceDocumentNumber === `IMP-${job?.id ?? ''}`)).toBe(true);
  expect(movements.flatMap(move => move.lines.map(line => line.quantityBase))).toContain(9_007_199_254_740_993n);

  const duplicate = await imports.previewImport({
    fileBytes, fileName: 'stock.xlsx', idempotencyKey: nextUuid(), warehouseScope,
  }, SUPPLIER);
  expect(duplicate.job?.errorCount).toBeGreaterThan(0);
  for (const [committed, scope] of [[applied, warehouseScope], [cellsJob, cellsScope]] as const) {
    const blocked = await captureError(imports.rollbackImport({
      expectedVersion: committed?.version, idempotencyKey: nextUuid(), jobId: committed?.id, warehouseScope: scope,
    }, SUPPLIER));
    expect(readErrorDetail(blocked).code).toBe(ErrorCode.IMPORT_ROLLBACK_BLOCKED);
  }
  expect((await topology.getWarehouseTopology(query, SUPPLIER)).topology?.revision).toBe(2);
  expect((await stock.listStockMovements(query, SUPPLIER)).movements).toEqual(movements);
});

it('preserves a schema 20 catalog preview and stock ledger across the version 21 migration', async () => {
  const { engine, storage } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const imports = createClient(ImportService, transport);
  const stock = createClient(WarehouseStockService, transport);
  const fileBytes = new Uint8Array(readFileSync(new URL('../../../../../../apps/web/e2e/fixtures/catalog-import.xlsx', import.meta.url)));
  const { job } = await imports.previewImport({
    fileBytes, fileName: 'catalog.xlsx', idempotencyKey: nextUuid(), templateId: 'catalog',
  }, SUPPLIER);

  const warehouseId = SUPPLIER_WAREHOUSE;
  const { products } = await createClient(CatalogService, transport).listProducts({}, SUPPLIER);
  const opened = await stock.postOpeningStock({
    cellId: '8f000001-0000-4000-8000-000000000006',
    idempotencyKey: nextUuid(),
    kind: HandlingUnitKind.PALLET,
    lines: [{ batchNumber: 'LOT-OLD', productId: products[0]?.id ?? '', quantityBase: 5n, status: StockStatus.AVAILABLE }],
    sourceDocumentNumber: 'WMS-OLD',
    sscc: '000000000000000017',
    warehouseId,
  }, SUPPLIER);

  const original = await storage.load();
  if (original === undefined) {
    throw new Error('Missing saved world');
  }

  await storage.replaceAll({ ...original, schemaVersion: 20 });
  const reopened = await createTestEngine({ storage });
  const reopenedTransport = createEngineTransport(reopened.engine, true);
  expect(await storage.load()).toEqual(original);
  expect((await createClient(ImportService, reopenedTransport).getImportJob({ jobId: job?.id }, SUPPLIER)).job).toEqual(job);
  expect((await createClient(WarehouseStockService, reopenedTransport).listStockMovements({ warehouseId }, SUPPLIER)).movements)
    .toEqual([opened.movement]);
});

it('rechecks layout permissions and revision before applying a preview', async () => {
  const { engine } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const imports = createClient(ImportService, transport);
  const topology = createClient(WarehouseTopologyService, transport);
  const warehouseScope = CELLS;
  const { warehouseId } = warehouseScope;
  const { job } = await imports.previewImport({
    fileBytes: buildImportXlsx(CELL_HEADERS, [CELL_ROW]), fileName: 'cells.xlsx', idempotencyKey: nextUuid(), warehouseScope,
  }, CUSTOMER);
  expect(job?.errorCount).toBe(0);
  const commit = { expectedVersion: job?.version, idempotencyKey: nextUuid(), jobId: job?.id, warehouseScope };
  expect(readErrorDetail(await captureError(imports.commitImport(commit, STOREKEEPER))).code).toBe(ErrorCode.PERMISSION_DENIED);
  expect((await topology.getWarehouseTopology({ warehouseId }, CUSTOMER)).topology?.revision).toBe(1);

  await topology.addWarehouseCells({
    cells: [{
      cellCode: 'Z01-R01-S01-Y03-C02',
      rackCode: 'S01',
      rowCode: 'R01',
      tierCode: 'Y03',
      tierElevationMm: 3_000,
      widthMm: 600,
      xOffsetMm: 600,
      zoneCode: 'Z01',
    }],
    expectedRevision: 1,
    idempotencyKey: nextUuid(),
    warehouseId,
  }, CUSTOMER);
  expect(readErrorDetail(await captureError(imports.commitImport(commit, CUSTOMER))).code).toBe(ErrorCode.VERSION_CONFLICT);
  expect((await imports.getImportJob({ jobId: job?.id, warehouseScope }, CUSTOMER)).job?.status).toBe(ImportStatus.PREVIEW);
});
