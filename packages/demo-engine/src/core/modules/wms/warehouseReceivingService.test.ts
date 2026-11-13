import type { Event } from '@skladburg/contracts/event/v1/event';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  BaseUnit,
  CatalogService,
  MarkingMode,
  SaveProductRequestSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealSchema,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentSchema,
  DocumentService,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';
import {
  PaymentService,
  PayoutStatus,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  HandlingUnitKind,
  StockBalanceSchema,
  StockMovementKind,
  StockStatus,
  WarehouseStockService,
} from '@skladburg/contracts/wms/v1/stock';
import {
  expect,
  it,
} from 'vitest';

import type { IDemoEngine } from '../../engine/engineTypes';
import type { TestEngineValue } from '../../engine/testing/engineHarness';

import { addWarehouseTopologies } from '../../engine/migrateWarehouseTopologies';
import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import {
  CUSTOMER_CALL,
  saveSalesTerms,
} from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildRub,
  GTIN_ONE,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import { createDealFixture } from '../deals/testing/dealFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { buildSsccKey } from './stockRecords';

const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
const SUPPLIER_WAREHOUSE = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
const CELL = '8f000002-0000-4000-8000-000000000006';
const AREA = '8f000002-0000-4000-8000-000000000010';
const SSCC = '000000000000000017';

const createClients = (engine: IDemoEngine): {
  catalog: ReturnType<typeof createClient<typeof CatalogService>>;
  deals: ReturnType<typeof createClient<typeof DealService>>;
  documents: ReturnType<typeof createClient<typeof DocumentService>>;
  payments: ReturnType<typeof createClient<typeof PaymentService>>;
  receiving: ReturnType<typeof createClient<typeof WarehouseReceivingService>>;
  stock: ReturnType<typeof createClient<typeof WarehouseStockService>>;
} => {
  const transport = createEngineTransport(engine, true);
  return {
    catalog: createClient(CatalogService, transport),
    deals: createClient(DealService, transport),
    documents: createClient(DocumentService, transport),
    payments: createClient(PaymentService, transport),
    receiving: createClient(WarehouseReceivingService, transport),
    stock: createClient(WarehouseStockService, transport),
  };
};

const prepareInbound = async (
  deliveryMethod: DeliveryMethod = DeliveryMethod.CUSTOMER,
  hasShippedSscc = false,
): Promise<{
  clients: ReturnType<typeof createClients>;
  dealId: string;
  editor: ReturnType<typeof callAs>;
  engine: Awaited<ReturnType<typeof createTestEngine>>;
  inventoryOnly: ReturnType<typeof callAs>;
  receiver: ReturnType<typeof callAs>;
  secondReceiver: ReturnType<typeof callAs>;
  ship: () => Promise<number>;
  signOnly: ReturnType<typeof callAs>;
}> => {
  const { harness, request } = await createDealFixture({ product: { gtin: GTIN_ONE } });
  if (deliveryMethod === DeliveryMethod.SUPPLIER) {
    await saveSalesTerms(harness, SUPPLIER_1_CALL, {
      ownDelivery: { minimumChargeMinor: 10_000n, pricePerKmMinor: 1_000n },
      preparationWorkingDays: 1,
    });
  }
  if (hasShippedSscc) {
    await harness.runtime.command((transaction) => {
      const id = nextUuid();
      const tenantId = SeedOrganizationId.CUSTOMER_1;
      const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2;
      const balance = create(StockBalanceSchema, {
        handlingUnit: { id, kind: HandlingUnitKind.PALLET, sscc: SSCC, tenantId, version: 3, warehouseId },
      });
      transaction.put('stockBalances', {
        bytes: toBinary(StockBalanceSchema, balance),
        id,
        lookupKey: buildSsccKey(tenantId, SSCC),
        scopeId: warehouseId,
      });
    });
  }
  const grant = async (permissions: string[]): Promise<ReturnType<typeof callAs>> => callAs(await addTestMember(harness, {
    organizationId: SeedOrganizationId.CUSTOMER_1,
    permissions,
    warehouseIds: [WAREHOUSE],
  }), SeedOrganizationId.CUSTOMER_1);
  const receiver = await grant(['task_edit', 'task_view']);
  const secondReceiver = await grant(['task_edit', 'task_view']);
  const inventoryOnly = await grant(['inventory_view', 'inventory_edit']);
  const editor = callAs(await addTestMember(harness, {
    organizationId: SeedOrganizationId.CUSTOMER_1,
    permissions: ['catalog_edit', 'catalog_view'],
    warehouseIds: [],
  }), SeedOrganizationId.CUSTOMER_1);
  const signOnly = callAs(await addTestMember(harness, {
    organizationId: SeedOrganizationId.CUSTOMER_1,
    permissions: ['document_sign'],
    warehouseIds: [],
  }), SeedOrganizationId.CUSTOMER_1);
  const snapshot = await harness.storage.load();
  const listingId = request.lines[0]?.listingId;
  if (snapshot === undefined || listingId === undefined) {
    throw new Error('Missing receiving fixture');
  }
  const engine = await createTestEngine({
    storage: createSpyStorage(addWarehouseTopologies(snapshot)),
    wmsInboundManifests: new Map([[request.dealId, {
      sourceDocumentNumber: 'RECEIVING-1',
      units: [
        { batches: [{ batchNumber: 'BATCH-1', listingId, quantityBase: 6n }], kind: HandlingUnitKind.PALLET, sscc: SSCC },
        { batches: [{ batchNumber: 'BATCH-1', listingId, quantityBase: 2n }], kind: HandlingUnitKind.PALLET },
        { batches: [{ batchNumber: 'BATCH-1', listingId, quantityBase: 2n }], kind: HandlingUnitKind.PALLET },
      ],
    }]]),
    wmsInboundWarehouseIds: [WAREHOUSE],
  });
  const clients = createClients(engine.engine);
  const dealId = request.dealId;
  const { deal: draft } = await clients.deals.createDealDraft(request, CUSTOMER_CALL);
  const { deal: submitted } = await clients.deals.submitDeal({
    dealId, expectedVersion: 1, goodsTotal: draft?.goodsTotal, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  const { deal: agreed } = await clients.deals.confirmDeal({
    dealId, expectedVersion: submitted?.version ?? 0, goodsTotal: submitted?.goodsTotal,
    idempotencyKey: nextUuid(), shipFromWarehouseId: SUPPLIER_WAREHOUSE,
  }, SUPPLIER_1_CALL);
  await clients.deals.chooseDelivery({
    dealId, deliveryMethod, expectedVersion: agreed?.version ?? 0, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  for (const document of (await clients.documents.listDealDocuments({ dealId }, SUPPLIER_1_CALL)).documents) {
    const sign = document.type === DocumentType.SUPPLY_CONTRACT ? clients.documents.signSupplyContract : clients.documents.signDocument;
    await sign({ dealId, documentId: document.id, expectedVersion: 1, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    await sign({ dealId, documentId: document.id, expectedVersion: 2, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
  }
  const { payment: invoice } = await clients.payments.getDealPayment({ dealId }, CUSTOMER_CALL);
  if (invoice?.goodsAmount === undefined || invoice.deliveryAmount === undefined) {
    throw new Error('Missing payment amounts');
  }
  await clients.payments.fundDeal({
    amount: buildRub(invoice.goodsAmount.amountMinor + invoice.deliveryAmount.amountMinor),
    dealId,
    expectedVersion: 1,
    idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  engine.realTime.advance(5 * 60_000);
  await engine.engine.tick();
  const { deal: paid } = await clients.deals.getDeal({ dealId }, CUSTOMER_CALL);
  const shipRequest = { dealId, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid() };
  const ship = async (): Promise<number> => {
    const { deal: shipped } = await clients.deals.markDealShipped(shipRequest, SUPPLIER_1_CALL);
    const arrival = shipped?.deadlines?.arrivalDueAt;
    if (arrival === undefined) {
      throw new Error('Missing arrival deadline');
    }
    return timestampMs(arrival);
  };

  return { clients, dealId, editor, engine, inventoryOnly, receiver, secondReceiver, ship, signOnly };
};

const tickAt = async (test: TestEngineValue, targetMs: number): Promise<void> => {
  const { timeScale, worldTimeMs } = test.engine.getClockSnapshot();
  test.realTime.advance(Math.ceil((targetMs - worldTimeMs) / timeScale));
  await test.engine.tick();
};

const failureCode = async (call: Promise<unknown>): Promise<ErrorCode> => readErrorDetail(await captureError(call)).code;

it('opens one private task on arrival and keeps the deal payment held after restart and after finishing the fact', async () => {
  const { clients, dealId, editor, engine, inventoryOnly, receiver, secondReceiver, ship } = await prepareInbound();
  const { products: [product] } = await clients.catalog.listProducts({ query: GTIN_ONE }, editor);
  if (product === undefined) {
    throw new Error('Missing linked product');
  }
  const savedProduct = create(SaveProductRequestSchema, {
    baseUnit: product.baseUnit,
    expectedVersion: product.version,
    gtin: product.gtin,
    idempotencyKey: nextUuid(),
    isDiscountForbidden: product.isDiscountForbidden,
    markingMode: product.markingMode,
    minPrice: product.minPrice,
    name: product.name,
    packagings: product.packagings,
    productId: product.id,
    shelfLifeDays: product.shelfLifeDays,
    sku: product.sku,
    storageTemperature: product.storageTemperature,
    vatRate: product.vatRate,
  });
  const { product: mismatched } = await clients.catalog.saveProduct({ ...savedProduct, baseUnit: BaseUnit.GRAM }, editor);
  const blockedShipment = await captureError(ship());
  expect(readErrorDetail(blockedShipment)).toMatchObject({
    code: ErrorCode.VALIDATION_FAILED,
    params: { case: 'validationFailed', value: { violations: [{ fieldPath: 'deal_id', ruleId: 'deal.product.unit_mismatch' }] } },
  });
  expect((await clients.payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.BLOCKED);
  const { product: repaired } = await clients.catalog.saveProduct({
    ...savedProduct, expectedVersion: mismatched?.version ?? 0n, idempotencyKey: nextUuid(),
  }, editor);
  const arrivalMs = await ship();
  expect((await clients.deals.getDealReceipt({ dealId }, CUSTOMER_CALL)).receipt)
    .toMatchObject({ dealId, lines: [] });
  expect((await clients.deals.getDealReceipt({ dealId }, CUSTOMER_CALL)).receipt?.updDocumentId).toBeTruthy();
  expect(await failureCode(clients.deals.getDealReceipt({ dealId }, receiver))).toBe(ErrorCode.PERMISSION_DENIED);
  const list = { warehouseId: WAREHOUSE };
  expect(await clients.receiving.listReceivingTasks(list, receiver)).toMatchObject({ tasks: [] });
  expect(await failureCode(clients.receiving.listReceivingTasks(list, inventoryOnly))).toBe(ErrorCode.PERMISSION_DENIED);
  expect(await failureCode(clients.receiving.listReceivingTasks(list, SUPPLIER_1_CALL))).toBe(ErrorCode.NOT_FOUND);

  const restored = await createTestEngine({ storage: engine.storage });
  const current = createClients(restored.engine);
  const postShipmentEdit = { ...savedProduct, expectedVersion: repaired?.version ?? 0n, idempotencyKey: nextUuid() };
  const changedUnit = await captureError(current.catalog.saveProduct({ ...postShipmentEdit, baseUnit: BaseUnit.GRAM }, editor));
  expect(readErrorDetail(changedUnit)).toMatchObject({
    code: ErrorCode.VALIDATION_FAILED,
    params: { case: 'validationFailed', value: { violations: [{ fieldPath: 'base_unit', ruleId: 'catalog.base_unit_locked' }] } },
  });
  await expect(current.catalog.saveProduct({ ...postShipmentEdit, name: 'Товар приёмки' }, editor))
    .resolves.toMatchObject({ product: { baseUnit: product.baseUnit, name: 'Товар приёмки' } });
  const events: Event[] = [];
  expect(restored.engine.subscribe(tasksChannel(WAREHOUSE), new Headers(receiver.headers), batch => events.push(...batch)).kind)
    .toBe('subscribed');
  await tickAt(restored, arrivalMs);
  await tickAt(restored, arrivalMs + 7 * 24 * 60 * 60_000);
  expect(events.map(event => event.payload.case)).toEqual(['receivingTasksChanged']);
  const { tasks } = await current.receiving.listReceivingTasks(list, receiver);
  expect(tasks).toMatchObject([{
    dealId,
    orderLines: [{ gtin: GTIN_ONE, quantityBase: 10n }],
    receivingAreaId: AREA,
    status: ReceivingTaskStatus.OPEN,
    version: 1,
  }]);
  expect(tasks[0]?.expectedUnits.map(unit => unit.sscc)).toEqual([SSCC, undefined, undefined]);

  const claim = { ...list, expectedVersion: 1, idempotencyKey: nextUuid(), taskId: dealId };
  const [assigned, conflict] = await Promise.allSettled([
    current.receiving.claimReceivingTask(claim, receiver),
    current.receiving.claimReceivingTask({ ...claim, idempotencyKey: nextUuid() }, secondReceiver),
  ]);
  expect(assigned).toMatchObject({ status: 'fulfilled', value: { task: { status: ReceivingTaskStatus.IN_PROGRESS } } });
  expect(conflict.status).toBe('rejected');
  const finish = { ...claim, expectedVersion: 2, idempotencyKey: nextUuid() };
  expect(await failureCode(current.receiving.finishReceivingTask(finish, secondReceiver))).toBe(ErrorCode.PERMISSION_DENIED);
  expect(await current.receiving.finishReceivingTask(finish, receiver))
    .toMatchObject({ task: { receivedUnits: [], status: ReceivingTaskStatus.READY_FOR_RECONCILIATION } });
  expect(await failureCode(current.receiving.receiveHandlingUnit({
    ...finish, expectedVersion: 3, idempotencyKey: nextUuid(), unit: { case: 'sscc', value: SSCC },
  }, receiver))).toBe(ErrorCode.INVALID_TRANSITION);

  const { deal } = await current.deals.getDeal({ dealId }, CUSTOMER_CALL);
  expect(deal?.status).toBe(DealStatus.ACCEPTING);
  expect(await failureCode(current.deals.acceptDeal({
    dealId, expectedVersion: deal?.version ?? 0, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL))).toBe(ErrorCode.INVALID_TRANSITION);
  expect((await current.payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment)
    .toMatchObject({ payouts: [], status: SafeDealPaymentStatus.HELD });
});

it('records labelled and unlabelled places once and moves the quarantined balance without rewriting the fact', async () => {
  const { clients, dealId, engine, inventoryOnly, receiver, ship } = await prepareInbound();
  await tickAt(engine, await ship());
  const base = { taskId: dealId, warehouseId: WAREHOUSE };
  const { task } = await clients.receiving.claimReceivingTask({
    ...base, expectedVersion: 1, idempotencyKey: nextUuid(),
  }, receiver);
  const firstUnlabelled = task?.expectedUnits[1]?.id ?? '';
  const secondUnlabelled = task?.expectedUnits[2]?.id ?? '';
  const labelled = { ...base, expectedVersion: 2, idempotencyKey: nextUuid(), unit: { case: 'sscc', value: SSCC } } as const;
  expect(await failureCode(clients.receiving.receiveHandlingUnit({
    ...labelled, unit: { case: 'sscc', value: '000000000000000024' },
  }, receiver))).toBe(ErrorCode.VALIDATION_FAILED);
  engine.storage.failNextCommit();
  expect(await failureCode(clients.receiving.receiveHandlingUnit(labelled, receiver))).toBe(ErrorCode.UNAVAILABLE);
  expect((await clients.stock.listStockBalances(base, inventoryOnly)).balances).toHaveLength(0);
  const received = await clients.receiving.receiveHandlingUnit(labelled, receiver);
  const handlingUnitId = received.task?.receivedUnits[0]?.balanceAtReceipt?.handlingUnit?.id ?? '';
  expect(received.task?.receivedUnits).toMatchObject([{
    balanceAtReceipt: { cellId: '', handlingUnit: { sscc: SSCC }, lines: [{ quantityBase: 6n }], receivingAreaId: AREA },
  }]);
  expect(await clients.receiving.receiveHandlingUnit(labelled, receiver)).toEqual(received);
  expect(await failureCode(clients.receiving.receiveHandlingUnit({
    ...labelled, expectedVersion: 3, idempotencyKey: nextUuid(),
  }, receiver))).toBe(ErrorCode.VALIDATION_FAILED);
  const unlabelled = {
    ...base,
    expectedVersion: 3,
    idempotencyKey: nextUuid(),
    unit: { case: 'unlabelledUnit', value: { expectedUnitId: firstUnlabelled, gtin: `0${GTIN_ONE}`, quantityBase: 1n } },
  } as const;
  expect(await failureCode(clients.receiving.receiveHandlingUnit({
    ...unlabelled, unit: { ...unlabelled.unit, value: { ...unlabelled.unit.value, gtin: '2000000000022' } },
  }, receiver))).toBe(ErrorCode.VALIDATION_FAILED);
  const { task: withUnlabelled } = await clients.receiving.receiveHandlingUnit(unlabelled, receiver);
  const firstAssigned = withUnlabelled?.receivedUnits[1]?.balanceAtReceipt?.handlingUnit?.sscc ?? '';
  expect(firstAssigned).toHaveLength(18);
  expect(hasGs1CheckDigit(firstAssigned)).toBe(true);
  expect(await failureCode(clients.receiving.receiveHandlingUnit({
    ...unlabelled, expectedVersion: 4, idempotencyKey: nextUuid(),
  }, receiver))).toBe(ErrorCode.VALIDATION_FAILED);
  const { task: withAll } = await clients.receiving.receiveHandlingUnit({
    ...unlabelled,
    expectedVersion: 4,
    idempotencyKey: nextUuid(),
    unit: { ...unlabelled.unit, value: { ...unlabelled.unit.value, expectedUnitId: secondUnlabelled, quantityBase: 3n } },
  }, receiver);
  const secondAssigned = withAll?.receivedUnits[2]?.balanceAtReceipt?.handlingUnit?.sscc ?? '';
  expect(secondAssigned).toHaveLength(18);
  expect(hasGs1CheckDigit(secondAssigned)).toBe(true);
  expect(secondAssigned).not.toBe(firstAssigned);

  expect(await failureCode(clients.stock.moveHandlingUnit({
    ...base, expectedVersion: 1, handlingUnitId, idempotencyKey: nextUuid(), sourceDocumentNumber: 'MOVE', toCellId: CELL,
  }, inventoryOnly))).toBe(ErrorCode.INVALID_TRANSITION);
  const finish = { ...base, expectedVersion: 5, idempotencyKey: nextUuid() };
  await clients.receiving.finishReceivingTask(finish, receiver);
  const putAway = { ...base, expectedVersion: 6, handlingUnitId, idempotencyKey: nextUuid(), toCellId: CELL };
  expect(await failureCode(clients.receiving.putAwayHandlingUnit({
    ...putAway, toCellId: '8f000001-0000-4000-8000-000000000006',
  }, receiver))).toBe(ErrorCode.NOT_FOUND);
  engine.storage.failNextCommit();
  expect(await failureCode(clients.receiving.putAwayHandlingUnit(putAway, receiver))).toBe(ErrorCode.UNAVAILABLE);
  const { task: placed } = await clients.receiving.putAwayHandlingUnit(putAway, receiver);
  expect(placed?.receivedUnits[0]).toMatchObject({
    balanceAtReceipt: received.task?.receivedUnits[0]?.balanceAtReceipt,
    putAwayCellId: CELL,
  });
  const reopened = createClients((await createTestEngine({ storage: engine.storage })).engine);
  expect(await reopened.receiving.putAwayHandlingUnit(putAway, receiver)).toMatchObject({ task: placed });
  expect(await failureCode(reopened.receiving.putAwayHandlingUnit({
    ...putAway, expectedVersion: 7, idempotencyKey: nextUuid(),
  }, receiver))).toBe(ErrorCode.INVALID_TRANSITION);
  const { balances } = await reopened.stock.listStockBalances(base, inventoryOnly);
  const placedBalance = balances.find(balance => balance.handlingUnit?.id === handlingUnitId);
  expect(placedBalance).toMatchObject({ cellId: CELL, lines: [{ quantityBase: 6n, status: StockStatus.QUARANTINE }] });
  expect(placedBalance?.receivingAreaId).toBeUndefined();
  expect(balances.map(balance => balance.lines[0]?.quantityBase).sort()).toEqual([1n, 3n, 6n]);
  const { movements } = await reopened.stock.listStockMovements(base, inventoryOnly);
  expect(movements.filter(movement => movement.kind === StockMovementKind.RECEIPT)).toHaveLength(3);
  expect(movements.filter(movement => movement.kind === StockMovementKind.TRANSFER)).toMatchObject([{
    dealId, fromReceivingAreaId: AREA, sourceDocumentNumber: task?.sourceDocumentNumber, toCellId: CELL,
  }]);
  expect((await reopened.payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment).toMatchObject({
    payouts: [], status: SafeDealPaymentStatus.HELD,
  });
});

it('opens receiving for supplier delivery and rejects a label previously shipped by the customer organization', async () => {
  const { clients, dealId, engine, inventoryOnly, receiver, ship } = await prepareInbound(DeliveryMethod.SUPPLIER, true);
  await tickAt(engine, await ship());
  const base = { taskId: dealId, warehouseId: WAREHOUSE };
  await clients.receiving.claimReceivingTask({ ...base, expectedVersion: 1, idempotencyKey: nextUuid() }, receiver);

  const error = await captureError(clients.receiving.receiveHandlingUnit({
    ...base,
    expectedVersion: 2,
    idempotencyKey: nextUuid(),
    unit: { case: 'sscc', value: SSCC },
  }, receiver));
  expect(readErrorDetail(error)).toMatchObject({
    code: ErrorCode.VALIDATION_FAILED,
    params: { case: 'validationFailed', value: { violations: [{ fieldPath: 'sscc', ruleId: 'scan_duplicate_code' }] } },
  });
  expect((await clients.stock.listStockMovements(base, inventoryOnly)).movements).toEqual([]);
  expect((await clients.receiving.listReceivingTasks(base, receiver)).tasks)
    .toMatchObject([{ receivedUnits: [], status: ReceivingTaskStatus.IN_PROGRESS, version: 2 }]);
});

it('opens a claim and classifies only signed receipt stock without closing the disputed payment', async () => {
  const { clients, dealId, engine, receiver, ship, signOnly } = await prepareInbound();
  await tickAt(engine, await ship());
  const command = { idempotencyKey: nextUuid(), taskId: dealId, warehouseId: WAREHOUSE };
  await clients.receiving.claimReceivingTask({ ...command, expectedVersion: 1 }, receiver);
  const { task } = await clients.receiving.receiveHandlingUnit({
    ...command, expectedVersion: 2, idempotencyKey: nextUuid(), unit: { case: 'sscc', value: SSCC },
  }, receiver);
  const handlingUnitId = task?.receivedUnits[0]?.balanceAtReceipt?.handlingUnit?.id;
  if (handlingUnitId === undefined) {
    throw new Error('Missing received unit');
  }
  await clients.receiving.finishReceivingTask({ ...command, expectedVersion: 3, idempotencyKey: nextUuid() }, receiver);
  const { deal } = await clients.deals.getDeal({ dealId }, CUSTOMER_CALL);
  const { receipt } = await clients.deals.getDealReceipt({ dealId }, CUSTOMER_CALL);
  expect(deal?.status).toBe(DealStatus.ACCEPTING);
  expect(receipt).toMatchObject({
    hasDiscrepancies: true,
    lines: [{ acceptedQuantityBase: 6n, documentedQuantityBase: 10n, orderedQuantityBase: 10n, shortageQuantityBase: 4n }],
  });
  const request = { dealId, expectedVersion: deal?.version ?? 0, idempotencyKey: nextUuid() };
  expect(await failureCode(clients.deals.confirmDealReceipt(request, CUSTOMER_CALL))).toBe(ErrorCode.INVALID_TRANSITION);
  expect(await failureCode(clients.deals.openDealReceiptClaim(request, SUPPLIER_1_CALL))).toBe(ErrorCode.PERMISSION_DENIED);
  const { deal: claimed } = await clients.deals.openDealReceiptClaim(request, CUSTOMER_CALL);
  expect(claimed?.status).toBe(DealStatus.CLAIM);
  const sign = { ...request, expectedVersion: claimed?.version ?? 0, idempotencyKey: nextUuid() };
  const signed = await clients.deals.confirmDealReceipt(sign, CUSTOMER_CALL);
  expect(signed.deal?.status).toBe(DealStatus.CLAIM);
  const payment = await clients.payments.getDealPayment({ dealId }, CUSTOMER_CALL);
  expect(payment.payment).toMatchObject({ status: SafeDealPaymentStatus.DISPUTE });
  expect(payment.payment?.partialReceipt?.acceptedGoodsAmount).toEqual(receipt?.lines[0]?.acceptedGoodsAmount);
  expect(await clients.deals.confirmDealReceipt(sign, CUSTOMER_CALL)).toEqual(signed);
  expect(await failureCode(clients.deals.confirmDealReceipt(sign, signOnly))).toBe(ErrorCode.PERMISSION_DENIED);
  expect(await failureCode(clients.deals.confirmDealReceipt({
    ...sign, expectedVersion: signed.deal?.version ?? 0, idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL))).toBe(ErrorCode.INVALID_TRANSITION);
  const { task: placed } = await clients.receiving.putAwayHandlingUnit({
    ...command, expectedVersion: 5, handlingUnitId, idempotencyKey: nextUuid(), toCellId: CELL,
  }, receiver);
  expect(placed).toMatchObject({
    receivedUnits: [{ balanceAtReceipt: { lines: [{ status: StockStatus.QUARANTINE }] }, putAwayCellId: CELL }],
    status: ReceivingTaskStatus.RECONCILED,
  });
  const { documents } = await clients.documents.listDealDocuments({ dealId }, SUPPLIER_1_CALL);
  expect(documents.filter(document => document.type > DocumentType.INVOICE).map(document => document.type)).toEqual([
    DocumentType.UPD, DocumentType.DISPATCH_TITLE, DocumentType.RECEIPT_TITLE, DocumentType.RECEIPT_DISCREPANCY_ACT,
    DocumentType.RECEIPT_CLAIM,
  ]);
  const signature = documents.find(document => document.type === DocumentType.RECEIPT_TITLE)?.signatures[0];
  expect(signature?.contentSha256).toMatch(/^[0-9a-f]{64}$/u);
  expect(signature?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
  const reopened = await createTestEngine({ storage: engine.storage });
  reopened.realTime.advance(10 * 60_000);
  await reopened.engine.tick();
  expect((await createClients(reopened.engine).payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment)
    .toMatchObject({ payouts: [{ status: PayoutStatus.PAID }], status: SafeDealPaymentStatus.DISPUTE });
});

it('confirms a fully received order once and releases the whole payment', async () => {
  const { clients, dealId, engine, inventoryOnly, receiver, ship } = await prepareInbound();
  await tickAt(engine, await ship());
  const command = { taskId: dealId, warehouseId: WAREHOUSE };
  const { task: claimed } = await clients.receiving.claimReceivingTask({
    ...command, expectedVersion: 1, idempotencyKey: nextUuid(),
  }, receiver);
  const { task: labelled } = await clients.receiving.receiveHandlingUnit({
    ...command, expectedVersion: 2, idempotencyKey: nextUuid(), unit: { case: 'sscc', value: SSCC },
  }, receiver);
  const handlingUnitId = labelled?.receivedUnits[0]?.balanceAtReceipt?.handlingUnit?.id ?? '';
  await clients.receiving.putAwayHandlingUnit({
    ...command, expectedVersion: 3, handlingUnitId, idempotencyKey: nextUuid(), toCellId: CELL,
  }, receiver);
  for (const [index, unit] of (claimed?.expectedUnits ?? []).slice(1).entries()) {
    await clients.receiving.receiveHandlingUnit({
      ...command,
      expectedVersion: index + 4,
      idempotencyKey: nextUuid(),
      unit: { case: 'unlabelledUnit', value: { expectedUnitId: unit.id, gtin: GTIN_ONE, quantityBase: 2n } },
    }, receiver);
  }
  await clients.receiving.finishReceivingTask({ ...command, expectedVersion: 6, idempotencyKey: nextUuid() }, receiver);
  const { deal } = await clients.deals.getDeal({ dealId }, CUSTOMER_CALL);
  const request = { dealId, expectedVersion: deal?.version ?? 0, idempotencyKey: nextUuid() };
  expect(await clients.deals.getDealReceipt({ dealId }, CUSTOMER_CALL)).toMatchObject({
    receipt: { hasDiscrepancies: false, lines: [{ acceptedQuantityBase: 10n }] },
  });
  expect(await failureCode(clients.deals.openDealReceiptClaim(request, CUSTOMER_CALL))).toBe(ErrorCode.INVALID_TRANSITION);
  engine.storage.failNextCommit();
  expect(await failureCode(clients.deals.confirmDealReceipt(request, CUSTOMER_CALL))).toBe(ErrorCode.UNAVAILABLE);
  expect((await clients.payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment)
    .toMatchObject({ payouts: [], status: SafeDealPaymentStatus.HELD });
  const current = (await clients.stock.listStockBalances(command, inventoryOnly)).balances;
  expect(current.find(balance => balance.handlingUnit?.id === handlingUnitId))
    .toMatchObject({ cellId: CELL, lines: [{ status: StockStatus.QUARANTINE }] });
  const confirmed = await clients.deals.confirmDealReceipt(request, CUSTOMER_CALL);
  expect(confirmed.deal?.status).toBe(DealStatus.ACCEPTED);
  expect(await clients.deals.confirmDealReceipt(request, CUSTOMER_CALL)).toEqual(confirmed);
  const { movements } = await clients.stock.listStockMovements(command, inventoryOnly);
  expect(movements.filter(movement => movement.kind === StockMovementKind.RECEIPT_CLASSIFICATION)).toHaveLength(3);
  const classified = (await clients.stock.listStockBalances(command, inventoryOnly)).balances;
  expect(classified.find(balance => balance.handlingUnit?.id === handlingUnitId))
    .toMatchObject({ cellId: CELL, lines: [{ status: StockStatus.AVAILABLE }] });
  engine.realTime.advance(10 * 60_000);
  await engine.engine.tick();
  expect((await clients.payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment)
    .toMatchObject({ payouts: [{ status: PayoutStatus.PAID }], status: SafeDealPaymentStatus.CLOSED });
});

it('backfills documents and a finished task atomically from a schema 23 world', async () => {
  const { clients, dealId, engine, receiver, ship } = await prepareInbound();
  await tickAt(engine, await ship());
  const command = { taskId: dealId, warehouseId: WAREHOUSE };
  await clients.receiving.claimReceivingTask({ ...command, expectedVersion: 1, idempotencyKey: nextUuid() }, receiver);
  await clients.receiving.finishReceivingTask({ ...command, expectedVersion: 2, idempotencyKey: nextUuid() }, receiver);
  const snapshot = await engine.storage.load();
  const record = snapshot?.collections.warehouseInbound.get(dealId);
  const dealBytes = snapshot?.collections.deals.get(dealId);
  if (snapshot === undefined || record === undefined || !('bytes' in record) || !(record.bytes instanceof Uint8Array)
    || !(dealBytes instanceof Uint8Array)) {
    throw new Error('Missing receipt snapshot');
  }
  const task = fromBinary(ReceivingTaskSchema, record.bytes);
  const deal = fromBinary(DealSchema, dealBytes);
  task.updDocumentId = undefined;
  task.sourceDocumentNumber = 'OLD-UPD';
  for (const orderLine of task.orderLines) {
    orderLine.markingMode = MarkingMode.UNSPECIFIED;
  }
  deal.status = DealStatus.ARRIVED;
  deal.transitions.pop();
  deal.version--;
  const anotherDealId = '00000000-0000-4000-8000-000000000001';
  const shipped = deal.transitions.find(transition => transition.to === DealStatus.SHIPPED);
  if (shipped?.at === undefined || task.finishedAt === undefined) {
    throw new Error('Missing legacy timestamps');
  }
  const earlierFinish = timestampFromMs(timestampMs(task.finishedAt) - 60_000);
  const laterShipment = timestampFromMs(timestampMs(shipped.at) + 60_000);
  const anotherDeal = create(DealSchema, {
    ...deal,
    id: anotherDealId,
    transitions: deal.transitions.map(transition => transition === shipped ? { ...transition, at: laterShipment } : transition),
  });
  const anotherTask = create(ReceivingTaskSchema, { ...task, dealId: anotherDealId, finishedAt: earlierFinish, id: anotherDealId });
  const documents = [...snapshot.collections.documents].filter(([, bytes]) =>
    !(bytes instanceof Uint8Array) || fromBinary(DocumentSchema, bytes).type <= DocumentType.INVOICE);
  const old = {
    ...snapshot,
    collections: {
      ...snapshot.collections,
      deals: new Map([
        ...snapshot.collections.deals, [anotherDealId, toBinary(DealSchema, anotherDeal)], [dealId, toBinary(DealSchema, deal)],
      ]),
      documents: new Map(documents),
      warehouseInbound: new Map([
        [anotherDealId, { ...record, bytes: toBinary(ReceivingTaskSchema, anotherTask), id: anotherDealId }],
        [dealId, { ...record, bytes: toBinary(ReceivingTaskSchema, task) }],
      ]),
    },
    schemaVersion: 23,
  };
  const storage = createSpyStorage(old);
  storage.failNextReplaceAll();
  await expect(createTestEngine({ storage })).rejects.toThrow('The saved world migration failed');
  expect(await storage.load()).toEqual(old);

  const restored = await createTestEngine({ storage });
  const current = createClients(restored.engine);
  const { receipt } = await current.deals.getDealReceipt({ dealId }, CUSTOMER_CALL);
  expect(receipt?.hasDiscrepancies).toBe(true);
  expect(receipt?.updDocumentId).toBeTruthy();
  expect(receipt?.discrepancyActDocumentId).toBeTruthy();
  expect((await current.deals.getDeal({ dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.ACCEPTING);
  const { tasks } = await current.receiving.listReceivingTasks(command, receiver);
  expect(tasks.find(candidate => candidate.dealId === dealId)?.sourceDocumentNumber).toBe('OLD-UPD');
  const first = await current.documents.listDealDocuments({ dealId }, CUSTOMER_CALL);
  const second = await current.documents.listDealDocuments({ dealId: anotherDealId }, CUSTOMER_CALL);
  const numberFor = (documents: typeof first.documents, type: DocumentType): number | undefined =>
    documents.find(document => document.type === type)?.number;
  expect(numberFor(first.documents, DocumentType.UPD)).toBe(2);
  expect(numberFor(second.documents, DocumentType.UPD)).toBe(3);
  expect(numberFor(first.documents, DocumentType.RECEIPT_DISCREPANCY_ACT)).toBe(3);
  expect(numberFor(second.documents, DocumentType.RECEIPT_DISCREPANCY_ACT)).toBe(2);
  const restarted = await createTestEngine({ storage });
  expect((await createClients(restarted.engine).deals.getDealReceipt({ dealId }, CUSTOMER_CALL)).receipt).toEqual(receipt);
});
