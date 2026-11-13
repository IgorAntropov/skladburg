import type {
  CallOptions,
  Client,
} from '@connectrpc/connect';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { Event } from '@skladburg/contracts/event/v1/event';

import { create } from '@bufbuild/protobuf';
import {
  ConnectError,
  createClient,
} from '@connectrpc/connect';
import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { ShowcaseService } from '@skladburg/contracts/catalog/v1/showcase';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  CreateDealDraftRequestSchema,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentService,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  PaymentService,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  PickingTaskStatus,
  WarehousePickingService,
} from '@skladburg/contracts/wms/v1/picking';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  HandlingUnitKind,
  StockMovementKind,
  StockStatus,
  WarehouseStockService,
} from '@skladburg/contracts/wms/v1/stock';
import {
  expect,
  it,
} from 'vitest';

import { addWarehouseTopologies } from '../../engine/migrateWarehouseTopologies';
import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import { createSeedSnapshot } from '../../seed/index';
import {
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import { TABLE_DEFINITIONS } from '../../state/index';
import { ENGINE_SCHEMA_VERSION } from '../../state/schemaVersion';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildAvailability,
  nextUuid,
} from '../catalog/testing/catalogFixtures';
import { createDealFixture } from '../deals/testing/dealFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const WAREHOUSE = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
const SECOND_WAREHOUSE = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2;
const SUPPLIER = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);

it('lists picking tasks through the engine and starts with an empty ledger', async () => {
  const { engine } = await createTestEngine();
  const client = createClient(WarehousePickingService, createEngineTransport(engine, true));

  await expect(client.listPickingTasks({ warehouseId: WAREHOUSE }, SUPPLIER)).resolves.toMatchObject({ tasks: [] });
});

const CELL = '8f000001-0000-4000-8000-000000000006';
const SSCC = '000000000000000017';

const createOutboundClients = (engine: Awaited<ReturnType<typeof createTestEngine>>['engine']): {
  deals: ReturnType<typeof createClient<typeof DealService>>;
  documents: ReturnType<typeof createClient<typeof DocumentService>>;
  payments: ReturnType<typeof createClient<typeof PaymentService>>;
  picking: ReturnType<typeof createClient<typeof WarehousePickingService>>;
  receiving: Client<typeof WarehouseReceivingService>;
  showcase: ReturnType<typeof createClient<typeof ShowcaseService>>;
  stock: ReturnType<typeof createClient<typeof WarehouseStockService>>;
} => {
  const transport = createEngineTransport(engine, true);
  return {
    deals: createClient(DealService, transport),
    documents: createClient(DocumentService, transport),
    payments: createClient(PaymentService, transport),
    picking: createClient(WarehousePickingService, transport),
    receiving: createClient(WarehouseReceivingService, transport),
    showcase: createClient(ShowcaseService, transport),
    stock: createClient(WarehouseStockService, transport),
  };
};

const prepareOutboundDeal = async (hasManualAlternative = false): Promise<{
  clients: ReturnType<typeof createOutboundClients>;
  engine: Awaited<ReturnType<typeof createTestEngine>>;
  inventoryOnly: CallOptions;
  opening: Parameters<ReturnType<typeof createOutboundClients>['stock']['postOpeningStock']>[0];
  request: Awaited<ReturnType<typeof createDealFixture>>['request'];
  secondPicker: CallOptions;
  unitId: string;
}> => {
  const { harness, request } = await createDealFixture(hasManualAlternative
    ? { listing: { availability: [buildAvailability(WAREHOUSE, 20n), buildAvailability(SECOND_WAREHOUSE, 20n)] } }
    : {});
  if (hasManualAlternative) {
    await harness.runtime.command((transaction) => {
      const first = transaction.get('warehouses', WAREHOUSE);
      const second = transaction.get('warehouses', SECOND_WAREHOUSE);
      const terms = transaction.get('salesTerms', SeedOrganizationId.SUPPLIER_1);
      if (first === undefined || second === undefined || terms === undefined) {
        throw new Error('Missing alternate warehouse or terms');
      }
      transaction.put('warehouses', { ...second, cityId: first.cityId, mapNodeId: first.mapNodeId, timeZone: first.timeZone });
      transaction.put('salesTerms', { ...terms, isAutoConfirmEnabled: true });
    });
  }
  const { listingId } = request.lines[0] ?? { listingId: '' };
  const { listing } = await harness.catalog.getOwnListing({ listingId }, SUPPLIER);
  const productId = listing?.listing?.productId;
  if (productId === undefined) {
    throw new Error('Missing listing product');
  }
  const secondPickerId = await addTestMember(harness, {
    organizationId: SeedOrganizationId.SUPPLIER_1,
    permissions: ['task_view', 'task_edit'],
    warehouseIds: [WAREHOUSE],
  });
  const inventoryOnlyId = await addTestMember(harness, {
    organizationId: SeedOrganizationId.SUPPLIER_1,
    permissions: ['inventory_view'],
    warehouseIds: [WAREHOUSE],
  });
  const snapshot = await harness.storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing test world');
  }
  const engine = await createTestEngine({
    storage: createSpyStorage(addWarehouseTopologies(snapshot)),
    wmsOutboundWarehouseIds: [WAREHOUSE],
  });
  const clients = createOutboundClients(engine.engine);
  const opening = {
    cellId: CELL,
    idempotencyKey: nextUuid(),
    kind: HandlingUnitKind.PALLET,
    lines: [{
      batchNumber: 'OUTBOUND-1',
      productId,
      quantityBase: hasManualAlternative ? 6n : 10n,
      status: StockStatus.AVAILABLE,
    }],
    sourceDocumentNumber: 'OPENING-1',
    sscc: SSCC,
    warehouseId: WAREHOUSE,
  };
  const { balance } = await clients.stock.postOpeningStock(opening, SUPPLIER);
  if (hasManualAlternative) {
    await clients.stock.postOpeningStock({ ...opening, idempotencyKey: nextUuid(), sscc: '000000000000000024' }, SUPPLIER);
  }
  if (balance?.handlingUnit === undefined) {
    throw new Error('Missing opening stock');
  }
  return {
    clients,
    engine,
    inventoryOnly: callAs(inventoryOnlyId, SeedOrganizationId.SUPPLIER_1),
    opening,
    request,
    secondPicker: callAs(secondPickerId, SeedOrganizationId.SUPPLIER_1),
    unitId: balance.handlingUnit.id,
  };
};

const submit = async (
  clients: ReturnType<typeof createOutboundClients>,
  request: Awaited<ReturnType<typeof createDealFixture>>['request'],
): Promise<Deal> => {
  const { deal: draft } = await clients.deals.createDealDraft(request, CUSTOMER_CALL);
  const { deal } = await clients.deals.submitDeal({
    dealId: request.dealId,
    expectedVersion: 1,
    goodsTotal: draft?.goodsTotal,
    idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  if (deal === undefined) {
    throw new Error('Missing submitted deal');
  }
  return deal;
};

const agreement = (deal: Deal): Parameters<ReturnType<typeof createOutboundClients>['deals']['confirmDeal']>[0] => ({
  dealId: deal.id,
  expectedVersion: deal.version,
  goodsTotal: deal.goodsTotal,
  idempotencyKey: nextUuid(),
  shipFromWarehouseId: WAREHOUSE,
});

const fundForPickup = async (
  clients: ReturnType<typeof createOutboundClients>,
  deal: Deal,
): Promise<void> => {
  await clients.deals.chooseDelivery({
    dealId: deal.id, deliveryMethod: DeliveryMethod.CUSTOMER, expectedVersion: deal.version, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  for (const document of (await clients.documents.listDealDocuments({ dealId: deal.id }, SUPPLIER)).documents) {
    const sign = document.type === DocumentType.SUPPLY_CONTRACT ? clients.documents.signSupplyContract : clients.documents.signDocument;
    await sign({ dealId: deal.id, documentId: document.id, expectedVersion: 1, idempotencyKey: nextUuid() }, SUPPLIER);
    await sign({ dealId: deal.id, documentId: document.id, expectedVersion: 2, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
  }
  await clients.payments.fundDeal({
    amount: deal.goodsTotal, dealId: deal.id, expectedVersion: 1, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
};

const getFailure = async (call: Promise<unknown>): Promise<ErrorCode> => readErrorDetail(await captureError(call)).code;

const GOLDEN_APPLE_LISTING = 'd1010001-0000-4000-8000-000000000000';

const createDemoOutboundDraft = (): ReturnType<typeof create<typeof CreateDealDraftRequestSchema>> =>
  create(CreateDealDraftRequestSchema, {
    dealId: nextUuid(),
    desiredDate: { day: 20, month: 10, year: 2026 },
    idempotencyKey: nextUuid(),
    lines: [{ listingId: GOLDEN_APPLE_LISTING, quantity: 480_000n }],
    shipFromCityId: SeedCityId.KRASNODAR,
    shipToWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    supplierOrganizationId: SeedOrganizationId.SUPPLIER_1,
  });

it('provisions the selected demo warehouse once and uses its real shipment for receiving', async () => {
  const stored = addWarehouseTopologies(createSeedSnapshot());
  const storage = createSpyStorage(stored);
  storage.failNextReplaceAll();
  await expect(createTestEngine({ isDemoWarehouseEnabled: true, storage })).rejects.toMatchObject({ name: 'SeedLoadError' });
  expect(await storage.load()).toEqual(stored);

  const start = await createTestEngine({ isDemoWarehouseEnabled: true, storage });
  const clients = createOutboundClients(start.engine);
  const provisioned = await storage.load();
  expect(provisioned?.collections.deals).toEqual(stored.collections.deals);
  expect(provisioned?.collections.documents).toEqual(stored.collections.documents);
  expect(provisioned?.collections.stockBalances.size).toBeGreaterThan(0);
  const { movements } = await clients.stock.listStockMovements({ warehouseId: SECOND_WAREHOUSE }, SUPPLIER);
  expect(movements[0]?.kind).toBe(StockMovementKind.OPENING_BALANCE);
  const request = createDemoOutboundDraft();
  const submitted = await submit(clients, request);
  const { deal } = await clients.deals.confirmDeal({ ...agreement(submitted), shipFromWarehouseId: SECOND_WAREHOUSE }, SUPPLIER);
  if (deal === undefined) {
    throw new Error('Missing agreement');
  }
  await fundForPickup(clients, deal);
  start.realTime.advance(5 * 60_000);
  await start.engine.tick();
  const base = { taskId: deal.id, warehouseId: SECOND_WAREHOUSE };
  const { task } = await clients.picking.claimPickingTask({ ...base, expectedVersion: 1, idempotencyKey: nextUuid() }, SUPPLIER);
  await clients.picking.confirmPicking({
    ...base, expectedVersion: 2, handlingUnitIds: task?.units.map(unit => unit.handlingUnit?.id ?? '') ?? [], idempotencyKey: nextUuid(),
  }, SUPPLIER);
  await clients.picking.confirmWarehouseShipment({ ...base, expectedVersion: 3, idempotencyKey: nextUuid() }, SUPPLIER);
  const { deal: shipped } = await clients.deals.getDeal({ dealId: deal.id }, CUSTOMER_CALL);
  expect(shipped?.status).toBe(DealStatus.SHIPPED);
  expect(shipped?.deadlines?.acceptanceDueAt).toBeUndefined();
  expect((await clients.deals.getDealReceipt({ dealId: deal.id }, CUSTOMER_CALL)).receipt?.updDocumentId).toBeTruthy();
  const before = await storage.load();
  expect(before?.collections.warehouseInbound.has(deal.id)).toBe(true);
  const restored = await createTestEngine({ isDemoWarehouseEnabled: true, storage });
  expect(await storage.load()).toEqual(before);

  const { tasks } = await createOutboundClients(restored.engine).receiving.listReceivingTasks(
    { warehouseId: request.shipToWarehouseId }, CUSTOMER_CALL,
  );
  expect(tasks).toEqual([]);
  restored.realTime.advance(9 * 24 * 60 * 60_000);
  await restored.engine.tick();
  expect((await createOutboundClients(restored.engine).receiving.listReceivingTasks(
    { warehouseId: request.shipToWarehouseId }, CUSTOMER_CALL,
  )).tasks).toMatchObject([{ dealId: deal.id, status: ReceivingTaskStatus.OPEN }]);
});

it('keeps a paid deal with a manual origin on the legacy route when the demo warehouse is enabled', async () => {
  const initial = await createTestEngine();
  const previous = createOutboundClients(initial.engine);
  const submitted = await submit(previous, createDemoOutboundDraft());
  const { deal } = await previous.deals.confirmDeal(agreement(submitted), SUPPLIER);
  if (deal === undefined) {
    throw new Error('Missing agreement');
  }
  await fundForPickup(previous, deal);
  initial.realTime.advance(5 * 60_000);
  await initial.engine.tick();

  const restored = await createTestEngine({ isDemoWarehouseEnabled: true, storage: initial.storage });
  const clients = createOutboundClients(restored.engine);
  const { deal: paid } = await clients.deals.getDeal({ dealId: deal.id }, SUPPLIER);
  const { deal: shipped } = await clients.deals.markDealShipped({
    dealId: deal.id, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid(),
  }, SUPPLIER);
  expect(shipped?.status).toBe(DealStatus.SHIPPED);
  expect(shipped?.deadlines?.acceptanceDueAt).toBeDefined();
  expect((await clients.deals.getDealReceipt({ dealId: deal.id }, CUSTOMER_CALL)).receipt).toBeUndefined();
});

it('preserves manual availability for a saved custom topology without a stock ledger', async () => {
  const snapshot = addWarehouseTopologies(createSeedSnapshot());
  const topology = createSeedWarehouseTopology({
    prefix: '8f000004', tenantId: SeedOrganizationId.SUPPLIER_1, warehouseId: SECOND_WAREHOUSE,
  });
  const warehouseTopologies = new Map(snapshot.collections.warehouseTopologies);
  warehouseTopologies.set(SECOND_WAREHOUSE, TABLE_DEFINITIONS.warehouseTopologies.encode(encodeWarehouseTopology(topology)));
  const customSnapshot = { ...snapshot, collections: { ...snapshot.collections, warehouseTopologies } };
  const storage = createSpyStorage(customSnapshot);
  const initial = await createTestEngine({ storage });
  const restored = await createTestEngine({ isDemoWarehouseEnabled: true, storage });
  expect(await storage.load()).toEqual(customSnapshot);

  const request = createDemoOutboundDraft();
  const listingRequest = { listingId: GOLDEN_APPLE_LISTING };
  const initialClients = createOutboundClients(initial.engine);
  const clients = createOutboundClients(restored.engine);
  const availability = (await initialClients.showcase.getShowcaseListing(listingRequest, CUSTOMER_CALL)).listing?.cityAvailability;
  expect((await clients.showcase.getShowcaseListing(listingRequest, CUSTOMER_CALL)).listing?.cityAvailability).toEqual(availability);
  const submitted = await submit(clients, request);
  const { deal } = await clients.deals.confirmDeal({ ...agreement(submitted), shipFromWarehouseId: SECOND_WAREHOUSE }, SUPPLIER);
  expect(deal).toMatchObject({ shipFromWarehouseId: SECOND_WAREHOUSE, status: DealStatus.AGREED });
  expect((await storage.load())?.collections.warehouseOutbound.has(submitted.id)).toBe(false);

  const catalog = createClient(CatalogService, createEngineTransport(restored.engine, true));
  const { listing } = await catalog.getOwnListing(listingRequest, SUPPLIER);
  const productId = listing?.listing?.productId;
  if (productId === undefined) {
    throw new Error('Missing listing product');
  }
  await clients.stock.postOpeningStock({
    cellId: '8f000004-0000-4000-8000-000000000006',
    idempotencyKey: nextUuid(),
    kind: HandlingUnitKind.PALLET,
    lines: [{ batchNumber: 'MANUAL-01', productId, quantityBase: 480_000n, status: StockStatus.AVAILABLE }],
    sourceDocumentNumber: 'OPENING-1',
    sscc: SSCC,
    warehouseId: SECOND_WAREHOUSE,
  }, SUPPLIER);
  const reopened = createOutboundClients((await createTestEngine({ isDemoWarehouseEnabled: true, storage })).engine);
  expect((await reopened.showcase.getShowcaseListing(listingRequest, CUSTOMER_CALL)).listing?.cityAvailability).toEqual(availability);
});

it('provisions without colliding with stock identifiers from the existing world', async () => {
  const initial = await createTestEngine();
  const clients = createOutboundClients(initial.engine);
  const catalog = createClient(CatalogService, createEngineTransport(initial.engine, true));
  const { listing } = await catalog.getOwnListing({ listingId: GOLDEN_APPLE_LISTING }, SUPPLIER);
  const productId = listing?.listing?.productId;
  const sku = listing?.product?.sku;
  if (productId === undefined || sku === undefined) {
    throw new Error('Missing listing product');
  }
  const manualBatch = `${sku}-DEMO-WMS-01`;
  const manualSscc = '090000000000000018';
  const manual = await clients.stock.postOpeningStock({
    cellId: CELL,
    idempotencyKey: nextUuid(),
    kind: HandlingUnitKind.PALLET,
    lines: [{ batchNumber: manualBatch, productId, quantityBase: 480_000n, status: StockStatus.AVAILABLE }],
    sourceDocumentNumber: 'OPENING-1',
    sscc: manualSscc,
    warehouseId: WAREHOUSE,
  }, SUPPLIER);

  const restored = await createTestEngine({ isDemoWarehouseEnabled: true, storage: initial.storage });
  const stock = createOutboundClients(restored.engine).stock;
  expect((await stock.listStockBalances({ warehouseId: WAREHOUSE }, SUPPLIER)).balances).toEqual([manual.balance]);
  const { balances } = await stock.listStockBalances({ page: { pageSize: 200 }, warehouseId: SECOND_WAREHOUSE }, SUPPLIER);
  const lines = balances.flatMap(unit => unit.lines).filter(line => line.batch?.productId === productId);
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.map(line => line.batch?.number)).toEqual(lines.map(() => `${sku}-DEMO-WMS-02`));
  expect(balances.every(unit => unit.handlingUnit?.sscc !== manualSscc)).toBe(true);
});

it('reserves one exact shipment across racing orders, publishes free quantity, and restores it on cancellation', async () => {
  const { clients, engine, request, unitId } = await prepareOutboundDeal();
  const listingId = request.lines[0]?.listingId ?? '';
  const getQuantity = async (): Promise<bigint | undefined> => {
    const { listing } = await clients.showcase.getShowcaseListing({ listingId }, CUSTOMER_CALL);
    return listing?.cityAvailability.find(city => city.cityId === request.shipFromCityId)?.quantity;
  };
  expect(await getQuantity()).toBe(10n);
  const first = await submit(clients, request);
  const second = await submit(clients, { ...request, dealId: nextUuid(), idempotencyKey: nextUuid() });
  const confirm = agreement(first);
  engine.storage.failNextCommit();
  expect(await getFailure(clients.deals.confirmDeal(confirm, SUPPLIER))).toBe(ErrorCode.UNAVAILABLE);
  expect(await getQuantity()).toBe(10n);
  const [agreed, rejected] = await Promise.allSettled([
    clients.deals.confirmDeal(confirm, SUPPLIER), clients.deals.confirmDeal(agreement(second), SUPPLIER),
  ]);
  expect(agreed).toMatchObject({ status: 'fulfilled', value: { deal: { status: DealStatus.AGREED } } });
  expect(rejected.status).toBe('rejected');
  if (agreed.status !== 'fulfilled' || rejected.status !== 'rejected') {
    throw new Error('Expected one agreement');
  }
  expect(readErrorDetail(ConnectError.from(rejected.reason)).code).toBe(ErrorCode.VALIDATION_FAILED);
  expect(await clients.deals.confirmDeal(confirm, SUPPLIER)).toEqual(agreed.value);
  expect(await getQuantity()).toBeUndefined();
  expect((await clients.picking.listPickingTasks({ warehouseId: WAREHOUSE }, SUPPLIER)).tasks).toEqual([]);
  expect((await clients.stock.listStockBalances({ warehouseId: WAREHOUSE }, SUPPLIER)).balances[0]?.lines[0]?.status)
    .toBe(StockStatus.RESERVED);
  expect(await getFailure(clients.stock.moveHandlingUnit({
    expectedVersion: 2, handlingUnitId: unitId, idempotencyKey: nextUuid(), sourceDocumentNumber: 'MOVE',
    toCellId: '8f000001-0000-4000-8000-000000000007', warehouseId: WAREHOUSE,
  }, SUPPLIER))).toBe(ErrorCode.INVALID_TRANSITION);

  const cancel = { dealId: first.id, expectedVersion: 3, idempotencyKey: nextUuid(), reason: 'Отмена заказа' };
  expect((await clients.deals.cancelDeal(cancel, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.CANCELLED);
  expect(await getQuantity()).toBe(10n);
  expect((await clients.stock.listStockMovements({ warehouseId: WAREHOUSE }, SUPPLIER)).movements
    .filter(movement => movement.dealId === first.id).map(movement => movement.kind).sort()).toEqual([
    StockMovementKind.RESERVE, StockMovementKind.RELEASE_RESERVATION,
  ]);
  expect((await clients.deals.confirmDeal(agreement(second), SUPPLIER)).deal?.status).toBe(DealStatus.AGREED);
});

it('opens a task on bank confirmation and ships only the picked stock, with retry and restart', async () => {
  const { clients, engine, inventoryOnly, opening, request, secondPicker, unitId } = await prepareOutboundDeal();
  const submitted = await submit(clients, request);
  const { deal } = await clients.deals.confirmDeal(agreement(submitted), SUPPLIER);
  if (deal === undefined) {
    throw new Error('Missing agreement');
  }
  await fundForPickup(clients, deal);
  const restored = await createTestEngine({ storage: engine.storage });
  const current = createOutboundClients(restored.engine);
  const events: Event[] = [];
  expect(restored.engine.subscribe(tasksChannel(WAREHOUSE), new Headers(secondPicker.headers), batch => events.push(...batch)).kind)
    .toBe('subscribed');
  expect(restored.engine.subscribe(tasksChannel(WAREHOUSE), new Headers(inventoryOnly.headers), () => undefined).kind).toBe('denied');
  expect(await getFailure(current.picking.listPickingTasks({ warehouseId: WAREHOUSE }, inventoryOnly))).toBe(ErrorCode.PERMISSION_DENIED);
  expect(await getFailure(current.picking.listPickingTasks({ warehouseId: WAREHOUSE }, CUSTOMER_CALL))).toBe(ErrorCode.NOT_FOUND);
  restored.realTime.advance(5 * 60_000);
  await restored.engine.tick();
  await restored.engine.tick();
  expect(events).toHaveLength(1);
  const list = { warehouseId: WAREHOUSE };
  expect((await current.picking.listPickingTasks(list, secondPicker)).tasks).toMatchObject([
    { dealId: deal.id, status: PickingTaskStatus.OPEN, units: [{ handlingUnit: { id: unitId, sscc: SSCC } }], version: 1 },
  ]);
  const { deal: paid } = await current.deals.getDeal({ dealId: deal.id }, CUSTOMER_CALL);
  expect(paid?.status).toBe(DealStatus.PAID);
  expect(await getFailure(current.deals.markDealShipped({
    dealId: deal.id, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid(),
  }, SUPPLIER))).toBe(ErrorCode.INVALID_TRANSITION);

  const base = { taskId: deal.id, warehouseId: WAREHOUSE };
  const claim = { ...base, expectedVersion: 1, idempotencyKey: nextUuid() };
  const [assigned, conflict] = await Promise.allSettled([
    current.picking.claimPickingTask(claim, secondPicker),
    current.picking.claimPickingTask({ ...claim, idempotencyKey: nextUuid() }, SUPPLIER),
  ]);
  expect(assigned).toMatchObject({ status: 'fulfilled', value: { task: { status: PickingTaskStatus.IN_PROGRESS } } });
  expect(conflict.status).toBe('rejected');
  expect(await getFailure(current.picking.confirmWarehouseShipment({
    ...base, expectedVersion: 2, idempotencyKey: nextUuid(),
  }, secondPicker))).toBe(ErrorCode.INVALID_TRANSITION);
  const pick = { ...base, expectedVersion: 2, handlingUnitIds: [unitId], idempotencyKey: nextUuid() };
  expect(await getFailure(current.picking.confirmPicking(pick, SUPPLIER))).toBe(ErrorCode.PERMISSION_DENIED);
  expect(await getFailure(current.picking.confirmPicking({ ...pick, handlingUnitIds: [nextUuid()] }, secondPicker)))
    .toBe(ErrorCode.VALIDATION_FAILED);
  expect(await getFailure(current.picking.confirmPicking({ ...pick, handlingUnitIds: [unitId, unitId] }, secondPicker)))
    .toBe(ErrorCode.VALIDATION_FAILED);
  expect((await current.picking.confirmPicking(pick, secondPicker)).task?.status).toBe(PickingTaskStatus.PICKED);

  const ship = { ...base, expectedVersion: 3, idempotencyKey: nextUuid() };
  restored.storage.failNextCommit();
  expect(await getFailure(current.picking.confirmWarehouseShipment(ship, secondPicker))).toBe(ErrorCode.UNAVAILABLE);
  expect((await current.deals.getDeal({ dealId: deal.id }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.PICKING);
  expect((await current.payments.getDealPayment({ dealId: deal.id }, CUSTOMER_CALL)).payment?.status)
    .toBe(SafeDealPaymentStatus.BLOCKED);
  expect((await current.stock.listStockBalances(list, SUPPLIER)).balances).toHaveLength(1);
  const shipped = await current.picking.confirmWarehouseShipment(ship, secondPicker);
  expect(shipped.task).toMatchObject({ status: PickingTaskStatus.SHIPPED, units: [{ handlingUnit: { id: unitId, sscc: SSCC } }] });
  expect(shipped.task?.shippedAt).toBeDefined();

  const reopened = createOutboundClients((await createTestEngine({ storage: restored.storage })).engine);
  expect(await reopened.picking.confirmWarehouseShipment(ship, secondPicker)).toEqual(shipped);
  expect((await reopened.deals.getDeal({ dealId: deal.id }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.SHIPPED);
  expect((await reopened.payments.getDealPayment({ dealId: deal.id }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.HELD);
  expect((await reopened.stock.listStockBalances(list, SUPPLIER)).balances).toEqual([]);
  expect(await getFailure(reopened.stock.postOpeningStock({ ...opening, idempotencyKey: nextUuid() }, SUPPLIER)))
    .toBe(ErrorCode.VALIDATION_FAILED);
  const movements = (await reopened.stock.listStockMovements(list, SUPPLIER)).movements;
  expect(movements.filter(movement => movement.kind === StockMovementKind.SHIPMENT)).toMatchObject([{
    dealId: deal.id,
    fromCellId: CELL,
    lines: [{ quantityBase: 10n, status: StockStatus.RESERVED }],
    toCellId: '',
  }]);
});

it('reserves the accepted counteroffer and cancels a picked task together with the refund', async () => {
  const { clients, engine, request, unitId } = await prepareOutboundDeal();
  const submitted = await submit(clients, request);
  const line = submitted.lines[0];
  if (line === undefined) {
    throw new Error('Missing submitted line');
  }
  const { deal: countered } = await clients.deals.counterDeal({
    dealId: submitted.id,
    desiredDate: submitted.desiredDate,
    expectedVersion: submitted.version,
    idempotencyKey: nextUuid(),
    lines: [{ lineId: line.id, price: line.price, quantity: line.quantity }],
    reason: 'Партия готова к отбору',
    shipFromWarehouseId: WAREHOUSE,
  }, SUPPLIER);
  const { deal } = await clients.deals.acceptCounterOffer({
    dealId: submitted.id,
    expectedVersion: countered?.version ?? 0,
    goodsTotal: countered?.counterOffer?.goodsTotal,
    idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  if (deal === undefined) {
    throw new Error('Missing accepted counteroffer');
  }
  await fundForPickup(clients, deal);
  engine.realTime.advance(5 * 60_000);
  await engine.engine.tick();
  const task = { taskId: deal.id, warehouseId: WAREHOUSE };
  await clients.picking.claimPickingTask({ ...task, expectedVersion: 1, idempotencyKey: nextUuid() }, SUPPLIER);
  await clients.picking.confirmPicking({
    ...task, expectedVersion: 2, handlingUnitIds: [unitId], idempotencyKey: nextUuid(),
  }, SUPPLIER);
  const { deal: picking } = await clients.deals.getDeal({ dealId: deal.id }, CUSTOMER_CALL);
  const cancel = { dealId: deal.id, expectedVersion: picking?.version ?? 0, idempotencyKey: nextUuid(), reason: 'Отмена поставки' };
  engine.storage.failNextCommit();
  expect(await getFailure(clients.deals.cancelDeal(cancel, CUSTOMER_CALL))).toBe(ErrorCode.UNAVAILABLE);
  expect((await clients.picking.listPickingTasks({ warehouseId: WAREHOUSE }, SUPPLIER)).tasks[0]?.status).toBe(PickingTaskStatus.PICKED);
  const cancelled = await clients.deals.cancelDeal(cancel, CUSTOMER_CALL);
  expect(await clients.deals.cancelDeal(cancel, CUSTOMER_CALL)).toEqual(cancelled);
  expect((await clients.payments.getDealPayment({ dealId: deal.id }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.REFUNDED);
  expect((await clients.picking.listPickingTasks({ warehouseId: WAREHOUSE }, SUPPLIER)).tasks[0]?.status).toBe(PickingTaskStatus.CANCELLED);
  expect((await clients.stock.listStockBalances({ warehouseId: WAREHOUSE }, SUPPLIER)).balances[0]?.lines[0]?.status)
    .toBe(StockStatus.AVAILABLE);
  expect(await getFailure(clients.picking.confirmWarehouseShipment({
    ...task, expectedVersion: 4, idempotencyKey: nextUuid(),
  }, SUPPLIER))).toBe(ErrorCode.INVALID_TRANSITION);
});

it('preserves version 21 stock, deals and command replies if migration must be retried', async () => {
  const { clients, engine, opening, request } = await prepareOutboundDeal();
  await submit(clients, request);
  const snapshot = await engine.storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing previous world');
  }
  const old = { ...snapshot, schemaVersion: 21 };
  const storage = createSpyStorage(old);
  storage.failNextReplaceAll();
  await expect(createTestEngine({ storage })).rejects.toMatchObject({ name: 'SeedLoadError' });
  expect(await storage.load()).toEqual(old);

  const migrated = createOutboundClients((await createTestEngine({ storage })).engine);
  expect(await storage.load()).toEqual({ ...old, schemaVersion: ENGINE_SCHEMA_VERSION });
  expect(await migrated.stock.postOpeningStock(opening, SUPPLIER)).toEqual(await clients.stock.postOpeningStock(opening, SUPPLIER));
  expect((await migrated.deals.getDeal({ dealId: request.dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.SUBMITTED);
  expect((await migrated.picking.listPickingTasks({ warehouseId: WAREHOUSE }, SUPPLIER)).tasks).toEqual([]);
});

it('preserves an open picking task across migration from version 22', async () => {
  const { clients, engine, request, unitId } = await prepareOutboundDeal();
  const submitted = await submit(clients, request);
  const { deal } = await clients.deals.confirmDeal(agreement(submitted), SUPPLIER);
  if (deal === undefined) {
    throw new Error('Missing agreement');
  }
  await fundForPickup(clients, deal);
  engine.realTime.advance(5 * 60_000);
  await engine.engine.tick();
  const snapshot = await engine.storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing previous world');
  }
  const storage = createSpyStorage({ ...snapshot, schemaVersion: 22 });

  const migrated = createOutboundClients((await createTestEngine({ storage })).engine);
  const { tasks } = await migrated.picking.listPickingTasks({ warehouseId: WAREHOUSE }, SUPPLIER);

  expect(tasks).toMatchObject([
    { dealId: deal.id, status: PickingTaskStatus.OPEN, units: [{ handlingUnit: { id: unitId, sscc: SSCC } }], version: 1 },
  ]);
  expect(await storage.load()).toEqual({ ...snapshot, schemaVersion: 24 });
});

it('uses another warehouse when the first cannot fill the order with whole handling units', async () => {
  const { clients, engine, request } = await prepareOutboundDeal(true);
  const submitted = await submit(clients, request);
  engine.realTime.advance(2 * 60_000);
  await engine.engine.tick();

  expect((await clients.deals.getDeal({ dealId: submitted.id }, CUSTOMER_CALL)).deal).toMatchObject({
    shipFromWarehouseId: SECOND_WAREHOUSE,
    status: DealStatus.AGREED,
  });
  expect((await clients.stock.listStockBalances({ warehouseId: WAREHOUSE }, SUPPLIER)).balances
    .flatMap(unit => unit.lines.map(line => line.status))).toEqual([StockStatus.AVAILABLE, StockStatus.AVAILABLE]);
});
