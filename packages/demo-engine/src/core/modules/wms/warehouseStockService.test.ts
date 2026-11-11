import type { Client } from '@connectrpc/connect';
import type { Product } from '@skladburg/contracts/catalog/v1/catalog';
import type { Event } from '@skladburg/contracts/event/v1/event';
import type { PostOpeningStockRequest } from '@skladburg/contracts/wms/v1/stock';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ConnectError,
  createClient,
} from '@connectrpc/connect';
import {
  BaseUnit,
  CatalogService,
} from '@skladburg/contracts/catalog/v1/catalog';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  ImportService,
  ImportStatus,
} from '@skladburg/contracts/import/v1/import';
import {
  inventoryChannel,
  SUPPORT_SESSION_HEADER,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessSection,
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';
import {
  HandlingUnitKind,
  PostOpeningStockRequestSchema,
  StockMovementKind,
  StockStatus,
  WarehouseStockService,
} from '@skladburg/contracts/wms/v1/stock';
import { StockChangedSchema } from '@skladburg/contracts/wms/v1/stock_events';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TestEngineValue } from '../../engine/testing/engineHarness';

import {
  createEngineTransport,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { TABLE_DEFINITIONS } from '../../state/index';
import { createTestSupportAccessSession } from '../../state/testRecords';
import {
  buildProductRequest,
  nextUuid,
} from '../catalog/testing/catalogFixtures';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';

const WAREHOUSE = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
const CELL_1 = '8f000001-0000-4000-8000-000000000006';
const CELL_2 = '8f000001-0000-4000-8000-000000000007';
const CELL_3 = '8f000001-0000-4000-8000-000000000008';
const FOREIGN_CELL = '8f000002-0000-4000-8000-000000000006';
const KEY_1 = 'f0000000-0000-4000-8000-000000000001';
const KEY_2 = 'f0000000-0000-4000-8000-000000000002';
const KEY_3 = 'f0000000-0000-4000-8000-000000000003';
const BIG_QUANTITY = 9_007_199_254_740_993n;
const SUPPLIER = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);

interface StockFixtureValue extends TestEngineValue {
  client: Client<typeof WarehouseStockService>;
  opening: PostOpeningStockRequest;
  products: Product[];
}

const createFixture = async (): Promise<StockFixtureValue> => {
  const fixture = await createTestEngine();
  const client = createClient(WarehouseStockService, createEngineTransport(fixture.engine, true));
  const snapshot = await fixture.storage.load();
  const products = [...(snapshot?.collections.products.values() ?? [])].map(TABLE_DEFINITIONS.products.decode);
  const product = products.find(candidate => candidate.tenantId === SeedOrganizationId.SUPPLIER_1);

  if (product === undefined) {
    throw new Error('Missing supplier product fixture');
  }

  const opening = create(PostOpeningStockRequestSchema, {
    cellId: CELL_1,
    idempotencyKey: KEY_1,
    kind: HandlingUnitKind.PALLET,
    lines: [
      { batchNumber: 'LOT-1', expiresOn: { day: 29, month: 2, year: 2028 },
        productId: product.id, quantityBase: BIG_QUANTITY, status: StockStatus.AVAILABLE },
      { batchNumber: 'LOT-2', productId: product.id, quantityBase: 7n, status: StockStatus.QUARANTINE },
    ],
    sourceDocumentNumber: 'WMS-1',
    sscc: '000000000000000017',
    warehouseId: WAREHOUSE,
  });

  return { ...fixture, client, opening, products };
};

describe('warehouse stock', () => {
  it('records both batches, the actor and the movement together and reads them after reopening', async () => {
    const { client, opening, storage } = await createFixture();
    const result = await client.postOpeningStock(opening, SUPPLIER);

    expect(result.balance).toMatchObject({
      cellId: CELL_1,
      handlingUnit: { sscc: opening.sscc, version: 1 },
      lines: [
        { batch: { number: 'LOT-1' }, quantityBase: BIG_QUANTITY, status: StockStatus.AVAILABLE },
        { batch: { number: 'LOT-2' }, quantityBase: 7n, status: StockStatus.QUARANTINE },
      ],
    });
    expect(result.movement).toMatchObject({
      actorUserId: SeedUserId.ADMIN_2,
      kind: StockMovementKind.OPENING_BALANCE,
      lines: result.balance?.lines,
      sourceDocumentNumber: opening.sourceDocumentNumber,
      toCellId: CELL_1,
    });
    expect(result.movement?.fromCellId).toBeUndefined();
    expect(result.movement?.occurredAt).toBeDefined();

    const restarted = await createTestEngine({ storage });
    const restored = createClient(WarehouseStockService, createEngineTransport(restarted.engine, true));
    expect((await restored.listStockBalances({ warehouseId: WAREHOUSE }, SUPPLIER)).balances).toEqual([result.balance]);
    expect((await restored.listStockMovements({ warehouseId: WAREHOUSE }, SUPPLIER)).movements).toEqual([result.movement]);
    expect(await restored.postOpeningStock(opening, SUPPLIER)).toEqual(result);
  });

  it('rejects a repeated SSCC with a new key without posting a second movement', async () => {
    const { client, opening } = await createFixture();
    const [first, second] = await Promise.allSettled([
      client.postOpeningStock(opening, SUPPLIER),
      client.postOpeningStock({ ...opening, idempotencyKey: KEY_2 }, SUPPLIER),
    ]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    expect((await client.listStockMovements({ warehouseId: WAREHOUSE }, SUPPLIER)).movements).toHaveLength(1);
  });

  it('rolls back the opening on storage failure and publishes only the successful retry to inventory subscribers', async () => {
    const { client, engine, opening, storage } = await createFixture();
    const events: Event[] = [];
    const cardEvents: Event[] = [];
    const headers = new Headers(SUPPLIER.headers);
    expect(engine.subscribe(inventoryChannel(WAREHOUSE), headers, published => events.push(...published)).kind).toBe('subscribed');
    expect(engine.subscribe(warehouseChannel(WAREHOUSE), headers, published => cardEvents.push(...published)).kind).toBe('subscribed');

    storage.failNextCommit();
    expect(readErrorDetail(await captureError(client.postOpeningStock(opening, SUPPLIER))).code).toBe(ErrorCode.UNAVAILABLE);
    expect(events).toEqual([]);
    expect((await client.listStockBalances({ warehouseId: WAREHOUSE }, SUPPLIER)).balances).toEqual([]);
    expect((await client.listStockMovements({ warehouseId: WAREHOUSE }, SUPPLIER)).movements).toEqual([]);

    await client.postOpeningStock(opening, SUPPLIER);
    expect(events.map(event => event.payload)).toEqual([
      { case: 'stockChanged', value: create(StockChangedSchema, { warehouseId: WAREHOUSE }) },
    ]);
    expect(cardEvents).toEqual([]);
  });

  it('moves all lines, rejects a racing stale version, and recovers the same balance from journal entries', async () => {
    const { client, opening } = await createFixture();
    const initial = await client.postOpeningStock(opening, SUPPLIER);
    const id = initial.balance?.handlingUnit?.id ?? '';
    const move = {
      expectedVersion: 1,
      handlingUnitId: id,
      idempotencyKey: KEY_2,
      sourceDocumentNumber: 'WMS-2',
      toCellId: CELL_2,
      warehouseId: WAREHOUSE,
    };
    const [first, second] = await Promise.allSettled([
      client.moveHandlingUnit(move, SUPPLIER),
      client.moveHandlingUnit({ ...move, idempotencyKey: KEY_3, toCellId: CELL_3 }, SUPPLIER),
    ]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');

    if (first.status !== 'fulfilled' || second.status !== 'rejected') {
      throw new Error('Expected exactly one move');
    }

    expect(readErrorDetail(ConnectError.from(second.reason)).code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(await client.moveHandlingUnit(move, SUPPLIER)).toEqual(first.value);
    expect(first.value.movement).toMatchObject({
      fromCellId: CELL_1,
      handlingUnit: { version: 2 },
      kind: StockMovementKind.TRANSFER,
      lines: initial.balance?.lines,
      toCellId: CELL_2,
    });

    const { movements } = await client.listStockMovements({ warehouseId: WAREHOUSE }, SUPPLIER);
    const ordered = movements.toSorted((current, prev) => (current.handlingUnit?.version ?? 0) - (prev.handlingUnit?.version ?? 0));
    const [openingEntry, moveEntry] = ordered;
    expect(ordered).toHaveLength(2);
    expect(moveEntry?.fromCellId).toBe(openingEntry?.toCellId);
    expect(moveEntry?.lines).toEqual(openingEntry?.lines);
    expect((await client.listStockBalances({ warehouseId: WAREHOUSE }, SUPPLIER)).balances).toMatchObject([
      { cellId: moveEntry?.toCellId, handlingUnit: moveEntry?.handlingUnit, lines: moveEntry?.lines },
    ]);
  });

  it('rejects foreign cells and a late foreign product without writing any earlier lines', async () => {
    const { client, opening, products } = await createFixture();
    const foreignProduct = products.find(product => product.tenantId !== SeedOrganizationId.SUPPLIER_1);
    expect(foreignProduct).toBeDefined();
    const foreignCell = await captureError(client.postOpeningStock({ ...opening, cellId: FOREIGN_CELL }, SUPPLIER));
    expect(readErrorDetail(foreignCell).code).toBe(ErrorCode.NOT_FOUND);
    const invalid = {
      ...opening,
      lines: opening.lines.map((line, index) => index === 1 ? { ...line, productId: foreignProduct?.id ?? '' } : line),
    };
    expect(readErrorDetail(await captureError(client.postOpeningStock(invalid, SUPPLIER))).code).toBe(ErrorCode.NOT_FOUND);
    expect((await client.listStockMovements({ warehouseId: WAREHOUSE }, SUPPLIER)).movements).toEqual([]);
    expect((await client.postOpeningStock(opening, SUPPLIER)).balance?.lines).toHaveLength(2);
  });
});

describe('stock validation and visibility', () => {
  it('validates SSCC, lot expiry, positive quantities and duplicate normalized lines', async () => {
    const { client, opening } = await createFixture();
    const first = opening.lines[0];
    if (first === undefined) {
      throw new Error('Expected an opening line');
    }

    const invalidExpiry = create(CalendarDateSchema, { day: 29, month: 2, year: 2027 });
    const cases = [
      { change: { sscc: '000000000000000018' }, rule: 'stock.sscc_checksum' },
      { change: { lines: [{ ...first, expiresOn: invalidExpiry }] }, rule: 'calendar_date.exists' },
      { change: { lines: [{ ...first, quantityBase: 0n }] }, rule: 'int64.gt' },
      { change: { lines: [{ ...first, quantityBase: -1n }] }, rule: 'int64.gt' },
      { change: { lines: [first, { ...first, batchNumber: ' LOT-1 ' }] }, rule: 'stock.duplicate_line' },
      { change: { lines: [{ ...first, batchNumber: 'क़'.repeat(64) }] }, rule: 'string.max_len' },
      { change: { sourceDocumentNumber: 'क़'.repeat(64) }, rule: 'string.max_len' },
    ];

    for (const { change, rule } of cases) {
      const error = await captureError(client.postOpeningStock({ ...opening, ...change }, SUPPLIER));
      const detail = readErrorDetail(error);
      expect(detail.params.case, `${rule}: ${error.message}`).toBe('validationFailed');
      if (detail.params.case === 'validationFailed') {
        expect(detail.params.value.violations).toContainEqual(expect.objectContaining({ ruleId: rule }));
      }
    }

    const initial = await client.postOpeningStock(opening, SUPPLIER);
    const next = {
      ...opening,
      idempotencyKey: KEY_2,
      lines: [{ ...first, expiresOn: create(CalendarDateSchema, { day: 28, month: 2, year: 2028 }) }],
      sscc: '000000000000000024',
    };
    const mismatch = readErrorDetail(await captureError(client.postOpeningStock(next, SUPPLIER)));
    expect(mismatch.params.value).toMatchObject({ violations: [expect.objectContaining({ ruleId: 'stock.batch_expiry_mismatch' })] });

    const matching = await client.postOpeningStock({ ...next, lines: [{ ...first, batchNumber: ' LOT-1 ' }] }, SUPPLIER);
    expect(matching.balance?.lines[0]?.batch).toEqual(initial.balance?.lines[0]?.batch);
  });

  it('keeps journal cursors scoped to a warehouse and hides balances from another organization', async () => {
    const { client, opening, realTime } = await createFixture();
    const initial = await client.postOpeningStock(opening, SUPPLIER);
    const foreign = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    for (const read of [client.listStockBalances, client.listStockMovements]) {
      const denied = await captureError(read({ warehouseId: WAREHOUSE }, foreign));
      expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
    }

    const move = {
      expectedVersion: 1,
      handlingUnitId: initial.balance?.handlingUnit?.id ?? '',
      idempotencyKey: KEY_2,
      sourceDocumentNumber: 'WMS-2',
      toCellId: CELL_1,
      warehouseId: WAREHOUSE,
    };
    const sameCell = readErrorDetail(await captureError(client.moveHandlingUnit(move, SUPPLIER)));
    expect(sameCell.params.value).toMatchObject({ violations: [expect.objectContaining({ ruleId: 'stock.same_cell' })] });

    const emptyWarehouseId = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2;
    const wrongWarehouse = await captureError(client.moveHandlingUnit({ ...move, warehouseId: emptyWarehouseId }, SUPPLIER));
    expect(readErrorDetail(wrongWarehouse).code).toBe(ErrorCode.NOT_FOUND);
    expect((await client.listStockBalances({ warehouseId: emptyWarehouseId }, SUPPLIER)).balances).toEqual([]);

    realTime.advance(1_000);
    const transfer = await client.moveHandlingUnit({ ...move, toCellId: CELL_2 }, SUPPLIER);
    const first = await client.listStockMovements({ page: { pageSize: 1 }, warehouseId: WAREHOUSE }, SUPPLIER);
    expect(first.movements).toEqual([transfer.movement]);
    const pageToken = first.page?.nextPageToken ?? '';
    expect(pageToken).not.toBe('');
    const rest = await client.listStockMovements({ page: { pageToken }, warehouseId: WAREHOUSE }, SUPPLIER);
    expect(rest.movements).toEqual([initial.movement]);
    const invalidCursor = await captureError(client.listStockMovements({
      page: { pageToken },
      warehouseId: emptyWarehouseId,
    }, SUPPLIER));
    expect(readErrorDetail(invalidCursor).code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});

it('audits a support read without allowing an edit or an inventory subscription', async () => {
  const { client, opening, storage } = await createFixture();
  const posted = await client.postOpeningStock(opening, SUPPLIER);
  const snapshot = await storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing world snapshot');
  }

  const organizationId = SeedOrganizationId.SUPPLIER_1;
  const staffId = SeedUserId.OPERATOR_SUPPORT_ENGINEER;
  const session = createTestSupportAccessSession(
    KEY_3,
    organizationId,
    staffId,
    SupportAccessStatus.ACTIVE,
    { expiresAt: timestampFromMs(snapshot.meta.worldTimeMs + 60_000), section: SupportAccessSection.WAREHOUSES },
  );
  await storage.commit({
    deletes: {},
    meta: snapshot.meta,
    puts: { supportAccessSessions: new Map([[session.id, TABLE_DEFINITIONS.supportAccessSessions.encode(session)]]) },
  });

  const { engine } = await createTestEngine({ storage });
  const stock = createClient(WarehouseStockService, createEngineTransport(engine, true));
  const headers = new Headers(callAs(staffId, organizationId).headers);
  headers.set(SUPPORT_SESSION_HEADER, session.id);
  expect((await stock.listStockBalances({ warehouseId: WAREHOUSE }, { headers })).balances).toEqual([posted.balance]);
  expect(readErrorDetail(await captureError(stock.postOpeningStock(opening, { headers }))).code).toBe(ErrorCode.PERMISSION_DENIED);
  expect(engine.subscribe(inventoryChannel(WAREHOUSE), headers, vi.fn()).kind).toBe('denied');

  const saved = await storage.load();
  const entries = [...(saved?.collections.supportAuditEntries.values() ?? [])].map(TABLE_DEFINITIONS.supportAuditEntries.decode);
  expect(entries).toEqual([
    expect.objectContaining({
      action: SupportAuditAction.READ,
      method: 'wms.v1.WarehouseStockService/ListStockBalances',
      outcome: SupportAuditOutcome.ALLOWED,
    }),
    expect.objectContaining({
      action: SupportAuditAction.CHANGE,
      method: 'wms.v1.WarehouseStockService/PostOpeningStock',
      outcome: SupportAuditOutcome.DENIED,
    }),
  ]);
});

it('blocks catalog rollback once the imported product has a posted stock movement', async () => {
  const { client, engine, opening } = await createFixture();
  const transport = createEngineTransport(engine, true);
  const imports = createClient(ImportService, transport);
  const catalog = createClient(CatalogService, transport);
  const sku = 'IMPORT-STOCK-001';
  const headers = [
    'name', 'sku', 'base_unit', 'marking_mode', 'vat_rate', 'packaging_name', 'packaging_quantity',
    'gross_weight_grams', 'volume_cubic_centimeters', 'length_millimeters', 'width_millimeters', 'height_millimeters',
    'sphere', 'price_unit_name', 'price_unit_base_quantity', 'min_order_quantity', 'order_step', 'price_rub',
  ];
  const values = ['Импортированный товар', sku, 'piece', 'none', '10', 'Короб', '12', '12500', '30000', '400', '300', '250',
    'Молочная продукция', 'шт.', '1', '10', '5', '123.45'];
  const preview = await imports.previewImport({
    fileBytes: new TextEncoder().encode([headers, values].map(row => row.join(';')).join('\n')),
    fileName: 'catalog.csv',
    idempotencyKey: KEY_1,
    templateId: 'catalog',
  }, SUPPLIER);
  expect(preview.job?.errorCount).toBe(0);

  const { job } = await imports.commitImport({
    expectedVersion: preview.job?.version,
    idempotencyKey: KEY_2,
    jobId: preview.job?.id,
  }, SUPPLIER);
  expect(job?.status).toBe(ImportStatus.COMMITTED);

  const { products } = await catalog.listProducts({ query: sku }, SUPPLIER);
  const product = products.find(candidate => candidate.sku === sku);
  if (product === undefined) {
    throw new Error('The import did not create the expected product');
  }

  const posted = await client.postOpeningStock({
    ...opening,
    lines: opening.lines.map(line => ({ ...line, productId: product.id })),
  }, SUPPLIER);
  const rollback = await captureError(imports.rollbackImport({
    expectedVersion: job?.version,
    idempotencyKey: KEY_3,
    jobId: job?.id,
  }, SUPPLIER));
  expect(readErrorDetail(rollback).code).toBe(ErrorCode.IMPORT_ROLLBACK_BLOCKED);
  expect((await catalog.listProducts({ query: sku }, SUPPLIER)).products).toEqual([product]);
  expect((await client.listStockMovements({ warehouseId: WAREHOUSE }, SUPPLIER)).movements).toEqual([posted.movement]);
});

it('keeps the catalog base unit stable after posting stock even before the first listing', async () => {
  const { client, engine, opening } = await createFixture();
  const catalog = createClient(CatalogService, createEngineTransport(engine, true));
  const draft = buildProductRequest({ sku: 'WMS-BASE-UNIT-001' });
  const { product } = await catalog.saveProduct(draft, SUPPLIER);
  if (product === undefined) {
    throw new Error('Expected a saved product');
  }
  expect(product.baseUnit).toBe(BaseUnit.PIECE);
  await client.postOpeningStock({
    ...opening,
    lines: opening.lines.map(line => ({ ...line, productId: draft.productId })),
  }, SUPPLIER);

  const error = await captureError(catalog.saveProduct({
    ...draft,
    baseUnit: BaseUnit.GRAM,
    expectedVersion: product.version,
    idempotencyKey: nextUuid(),
  }, SUPPLIER));
  expect(readErrorDetail(error).params.value).toMatchObject({
    violations: [{ fieldPath: 'base_unit', ruleId: 'catalog.base_unit_locked' }],
  });
});
