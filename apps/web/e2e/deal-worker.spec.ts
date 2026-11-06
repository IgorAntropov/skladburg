import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { ConnectError } from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';
import {
  dealChannel,
  organizationChannel,
} from '@skladburg/contracts/runtime';
import { randomUUID } from 'node:crypto';

import type { DealWorkerRobotValue } from './robots/deal-worker-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import {
  createDealWorkerRobot,
  DEAL_CUSTOMER,
  DEAL_SUPPLIER,
} from './robots/deal-worker-robot.ts';

const LISTING_ID = 'd1010001-0000-4000-8000-000000000000';
const CUSTOMER_WAREHOUSE_ID = '80000001-0000-4000-8000-000000000000';
const SUPPLIER_WAREHOUSE_ID = '80000004-0000-4000-8000-000000000000';
const SHIP_FROM_CITY_ID = '60000004-0000-4000-8000-000000000000';

const expectDomainFailure = async (operation: Promise<unknown>, code: ErrorCode): Promise<void> => {
  try {
    await operation;
  }
  catch (error: unknown) {
    expect(error).toBeInstanceOf(ConnectError);
    const failure = ConnectError.from(error);
    expect(failure.findDetails(ErrorDetailSchema).map(detail => detail.code)).toContain(code);
    return;
  }
  throw new Error('The operation must fail with a domain error');
};

const requireDeal = (deal: Deal | undefined): Deal => {
  if (deal === undefined) {
    throw new Error('The command must return a deal');
  }
  return deal;
};

const createDraft = async (customer: DealWorkerRobotValue): Promise<Deal> => {
  const listingResponse = await customer.showcase.getShowcaseListing({
    listingId: LISTING_ID,
    toWarehouseId: CUSTOMER_WAREHOUSE_ID,
  });
  const listing = listingResponse.listing;
  if (listing === undefined) {
    throw new Error('The seed listing must be visible to the customer');
  }
  const request = {
    dealId: randomUUID(),
    desiredDate: { day: 20, month: 10, year: 2026 },
    idempotencyKey: randomUUID(),
    lines: [{ listingId: listing.id, quantity: listing.minOrderQuantity }],
    shipFromCityId: SHIP_FROM_CITY_ID,
    shipToWarehouseId: CUSTOMER_WAREHOUSE_ID,
    supplierOrganizationId: DEAL_SUPPLIER.organizationId,
  };
  const created = await customer.deals.createDealDraft(request);
  expect(await customer.deals.createDealDraft(request)).toEqual(created);
  const deal = requireDeal(created.deal);
  expect(deal).toMatchObject({ goodsTotal: { amountMinor: 4_272_000n }, status: DealStatus.DRAFT, version: 1 });
  expect(deal.lines[0]?.productSnapshot).not.toHaveProperty('sku');
  expect(deal.lines[0]?.productSnapshot).not.toHaveProperty('minPrice');
  return deal;
};

const dealNotices = async (worker: DealWorkerRobotValue, dealId: string): Promise<DealNotice[]> => {
  const response = await worker.notifications.listNotifications({});
  return response.notifications.flatMap(notification =>
    notification.params.case === 'dealUpdate' && notification.params.value.dealId === dealId
      ? [notification.params.value.notice]
      : [],
  );
};

test('negotiates between two Workers, keeps drafts private and restores the agreed order', async ({ context, page }) => {
  const supplierPage = await context.newPage();
  const customer = await createDealWorkerRobot(page, DEAL_CUSTOMER);
  const supplier = await createDealWorkerRobot(supplierPage, DEAL_SUPPLIER);
  let hasStoppedWorkers = false;
  let draft: Deal | undefined;
  let epoch: string | undefined;

  try {
    await expect.poll(customer.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await expect.poll(supplier.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const initialStatus = await customer.readStartup();
    if (initialStatus?.kind !== 'ready') {
      throw new Error('The customer Worker must be ready');
    }
    epoch = initialStatus.epoch;
    expect(await supplier.readStartup()).toMatchObject({ epoch });
    const supplierOrg = await supplier.subscribe(organizationChannel(DEAL_SUPPLIER.organizationId));
    expect(supplierOrg.kind).toBe('subscribed');

    draft = await createDraft(customer);
    expect((await supplier.deals.listDeals({})).deals).toEqual([]);
    await expectDomainFailure(supplier.deals.getDeal({ dealId: draft.id }), ErrorCode.NOT_FOUND);
    const denied = await supplier.subscribe(dealChannel(draft.id));
    expect(denied).toMatchObject({ error: { code: ErrorCode.NOT_FOUND }, kind: 'denied' });
    expect(await dealNotices(supplier, draft.id)).toEqual([]);
    expect((await supplier.readEvents(supplierOrg.id)).filter(event => event.payload.case === 'dealChanged')).toEqual([]);

    const submitted = requireDeal((await customer.deals.submitDeal({
      dealId: draft.id,
      expectedVersion: draft.version,
      goodsTotal: draft.goodsTotal,
      idempotencyKey: randomUUID(),
    })).deal);
    expect(submitted.status).toBe(DealStatus.SUBMITTED);
    expect((await supplier.deals.getDeal({ dealId: draft.id })).deal).toMatchObject({
      goodsTotal: submitted.goodsTotal,
      id: submitted.id,
      status: DealStatus.SUBMITTED,
      version: submitted.version,
    });
    await expect.poll(() => dealNotices(supplier, submitted.id)).toContain(DealNotice.RECEIVED);
    await expect.poll(async () => (await supplier.readEvents(supplierOrg.id))
      .filter(event => event.payload.case === 'dealChanged').length).toBe(1);
    const supplierDeal = await supplier.subscribe(dealChannel(submitted.id));
    const customerDeal = await customer.subscribe(dealChannel(submitted.id));
    expect(supplierDeal.kind).toBe('subscribed');
    expect(customerDeal.kind).toBe('subscribed');

    const countered = requireDeal((await supplier.deals.counterDeal({
      dealId: submitted.id,
      desiredDate: { day: 21, month: 10, year: 2026 },
      expectedVersion: submitted.version,
      idempotencyKey: randomUUID(),
      lines: submitted.lines.map(line => ({ lineId: line.id, price: line.price, quantity: line.quantity })),
      reason: 'Отгрузим на день позже',
      shipFromWarehouseId: SUPPLIER_WAREHOUSE_ID,
    })).deal);
    expect(countered.status).toBe(DealStatus.COUNTER_OFFERED);
    await expectDomainFailure(supplier.deals.confirmDeal({
      dealId: submitted.id,
      expectedVersion: submitted.version,
      goodsTotal: submitted.goodsTotal,
      idempotencyKey: randomUUID(),
      shipFromWarehouseId: SUPPLIER_WAREHOUSE_ID,
    }), ErrorCode.VERSION_CONFLICT);
    const accepted = requireDeal((await customer.deals.acceptCounterOffer({
      dealId: submitted.id,
      expectedVersion: countered.version,
      goodsTotal: countered.counterOffer?.goodsTotal,
      idempotencyKey: randomUUID(),
    })).deal);
    expect(accepted).toMatchObject({
      desiredDate: { day: 21, month: 10, year: 2026 },
      shipFromWarehouseId: SUPPLIER_WAREHOUSE_ID,
      status: DealStatus.AGREED,
    });
    const chosen = requireDeal((await customer.deals.chooseDelivery({
      dealId: accepted.id,
      deliveryMethod: DeliveryMethod.CUSTOMER,
      expectedVersion: accepted.version,
      idempotencyKey: randomUUID(),
    })).deal);
    expect(chosen).toMatchObject({ deliveryTotal: { amountMinor: 0n }, status: DealStatus.LOGISTICS_CHOSEN });
    await expect.poll(async () => (await supplier.readEvents(supplierDeal.id)).map(event => event.seq)).toEqual([3n, 4n, 5n]);
    await expect.poll(async () => (await customer.readEvents(customerDeal.id)).map(event => event.seq)).toEqual([3n, 4n, 5n]);
    expect((await supplier.readEvents(supplierDeal.id)).map(event => event.epoch)).toEqual([epoch, epoch, epoch]);
    expect(await dealNotices(supplier, draft.id)).toContain(DealNotice.CONFIRMED);
    const { documents } = await supplier.documents.listDealDocuments({ dealId: chosen.id });
    const contract = documents.find(document => document.type === DocumentType.SUPPLY_CONTRACT);
    if (contract === undefined) {
      throw new Error('The first deal must have a supply contract draft');
    }
    expect(documents).toHaveLength(3);
    const first = await supplier.documents.signSupplyContract({
      dealId: chosen.id, documentId: contract.id, expectedVersion: contract.version, idempotencyKey: randomUUID(),
    });
    expect(first.document).toMatchObject({ number: 1, status: DocumentStatus.APPROVED });
    const second = await customer.documents.signSupplyContract({
      dealId: chosen.id, documentId: contract.id, expectedVersion: 2, idempotencyKey: randomUUID(),
    });
    expect(second.document).toMatchObject({ number: 1, status: DocumentStatus.SIGNED });
    expect(second.document?.signatures[0]?.contentSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(second.document?.signatures[0]?.contentSha256).toBe(second.document?.signatures[1]?.contentSha256);
    await supplier.stop();
    await customer.stop();
    hasStoppedWorkers = true;
  }
  finally {
    if (!hasStoppedWorkers) {
      await supplier.stop();
      await customer.stop();
    }
    await supplierPage.close();
  }

  const saved = requireDeal(draft);
  const restored = await createDealWorkerRobot(page, DEAL_CUSTOMER);
  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const restoredStatus = await restored.readStartup();
    if (restoredStatus?.kind !== 'ready') {
      throw new Error('The restored Worker must be ready');
    }
    const restoredEpoch = restoredStatus.epoch;
    expect(restoredEpoch).not.toBe(epoch);
    const response = await restored.deals.getDeal({ dealId: saved.id });
    expect(response.deal).toMatchObject({ id: saved.id, status: DealStatus.LOGISTICS_CHOSEN, version: 5 });
    expect(response.contract?.id).toBe(saved.contractId);
    const restoredDocuments = await restored.documents.listDealDocuments({ dealId: saved.id });
    expect(restoredDocuments.documents[0]).toMatchObject({ number: 1, status: DocumentStatus.SIGNED, type: DocumentType.SUPPLY_CONTRACT });
    const subscription = await restored.subscribe(dealChannel(saved.id));
    expect(subscription).toMatchObject({ epoch: restoredEpoch, kind: 'subscribed' });
    const cancelled = requireDeal((await restored.deals.cancelDeal({
      dealId: saved.id,
      expectedVersion: 5,
      idempotencyKey: randomUUID(),
      reason: 'Поставка больше не требуется',
    })).deal);
    expect(cancelled.status).toBe(DealStatus.CANCELLED);
    await expect.poll(async () => (await restored.readEvents(subscription.id)).length).toBe(1);
    expect(await restored.reset()).toBe('control_result');
    await expect.poll(async () => {
      const status = await restored.readStartup();
      return status?.kind === 'ready' && status.epoch !== restoredEpoch;
    }).toBe(true);
    await expectDomainFailure(restored.deals.getDeal({ dealId: saved.id }), ErrorCode.NOT_FOUND);
    expect(await restored.subscribe(dealChannel(saved.id))).toMatchObject({ kind: 'denied' });
  }
  finally {
    await restored.stop();
  }
});

test('keeps a draft cancelled before submission invisible to the supplier after restart', async ({ context, page }) => {
  const customer = await createDealWorkerRobot(page, DEAL_CUSTOMER);
  let dealId: string;
  try {
    const draft = await createDraft(customer);
    dealId = draft.id;
    await customer.deals.cancelDeal({
      dealId,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
      reason: 'Черновик больше не нужен',
    });
  }
  finally {
    await customer.stop();
  }
  const supplierPage = await context.newPage();
  const supplier = await createDealWorkerRobot(supplierPage, DEAL_SUPPLIER);
  try {
    await expectDomainFailure(supplier.deals.getDeal({ dealId }), ErrorCode.NOT_FOUND);
    expect((await supplier.deals.listDeals({})).deals).toEqual([]);
    expect(await dealNotices(supplier, dealId)).toEqual([]);
    expect(await supplier.subscribe(dealChannel(dealId))).toMatchObject({ error: { code: ErrorCode.NOT_FOUND }, kind: 'denied' });
  }
  finally {
    await supplier.stop();
    await supplierPage.close();
  }
});
