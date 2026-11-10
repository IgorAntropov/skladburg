import type { Page } from '@playwright/test';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { ConnectError } from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  PayoutStatus,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import { randomUUID } from 'node:crypto';

import type { DealWorkerRobotValue } from './robots/deal-worker-robot.ts';
import type { WorkerActingContextValue } from './robots/engine-worker-robot.ts';

import { freezeEngineClock } from './fixtures/engineClock.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import {
  createDealWorkerRobot,
  DEAL_CUSTOMER,
} from './robots/deal-worker-robot.ts';

const MOSCOW_ID = '60000001-0000-4000-8000-000000000000';
const CUSTOMER_WAREHOUSE_ID = '80000001-0000-4000-8000-000000000000';
const SUPPLIER_WAREHOUSE_ID = '80000012-0000-4000-8000-000000000000';
const LISTING_ID = 'd1060003-0000-4000-8000-000000000000';
const VEHICLE_ID = 'e1000002-0000-4000-8000-000000000000';
const DRIVER_ID = 'e2000001-0000-4000-8000-000000000000';
const SUPPLIER: WorkerActingContextValue = {
  organizationId: '10000010-0000-4000-8000-000000000000',
  userId: '20000017-0000-4000-8000-000000000000',
};
const CARRIER: WorkerActingContextValue = {
  organizationId: '10000004-0000-4000-8000-000000000000',
  userId: '20000004-0000-4000-8000-000000000000',
};
const RATE = { amountMinor: 100_000n, currencyCode: 'RUB' };
const MINUTE_MS = 60_000;

const required = <TValue>(value: TValue | undefined, entity: string): TValue => {
  if (value === undefined) {
    throw new Error(`Expected ${entity}`);
  }
  return value;
};

const expectHidden = async (call: Promise<unknown>): Promise<void> => {
  try {
    await call;
  }
  catch (error: unknown) {
    expect(ConnectError.from(error).findDetails(ErrorDetailSchema).map(detail => detail.code)).toContain(ErrorCode.NOT_FOUND);
    return;
  }
  throw new Error('Expected the record to be hidden');
};

const agreeDeal = async (customer: DealWorkerRobotValue, supplier: DealWorkerRobotValue): Promise<Deal> => {
  const { listing } = await customer.showcase.getShowcaseListing({ listingId: LISTING_ID, toWarehouseId: CUSTOMER_WAREHOUSE_ID });
  const dealId = randomUUID();
  const { deal: draft } = await customer.deals.createDealDraft({
    dealId,
    desiredDate: { day: 13, month: 10, year: 2026 },
    idempotencyKey: randomUUID(),
    lines: [{ listingId: LISTING_ID, quantity: required(listing, 'the seed listing').minOrderQuantity }],
    shipFromCityId: MOSCOW_ID,
    shipToWarehouseId: CUSTOMER_WAREHOUSE_ID,
    supplierOrganizationId: SUPPLIER.organizationId,
  });
  const { deal: submitted } = await customer.deals.submitDeal({
    dealId,
    expectedVersion: required(draft, 'the deal draft').version,
    goodsTotal: draft?.goodsTotal,
    idempotencyKey: randomUUID(),
  });
  const { deal } = await supplier.deals.confirmDeal({
    dealId,
    expectedVersion: required(submitted, 'the submitted deal').version,
    goodsTotal: submitted?.goodsTotal,
    idempotencyKey: randomUUID(),
    shipFromWarehouseId: SUPPLIER_WAREHOUSE_ID,
  });
  return required(deal, 'the agreed deal');
};

const signGoodsDocuments = async (customer: DealWorkerRobotValue, supplier: DealWorkerRobotValue, dealId: string): Promise<void> => {
  const { documents } = await supplier.documents.listDealDocuments({ dealId });
  expect(documents).toHaveLength(3);
  const contract = documents.find(document => document.type === DocumentType.SUPPLY_CONTRACT);
  expect(contract?.status).toBe(DocumentStatus.SIGNED);
  const invoice = documents.find(document => document.type === DocumentType.INVOICE);
  expect(invoice?.content?.terms).toMatchObject({ case: 'invoice', value: { deliveryTotal: { amountMinor: 0n } } });

  for (const document of documents.filter(document => document.type !== DocumentType.SUPPLY_CONTRACT)) {
    const request = { dealId, documentId: document.id, expectedVersion: document.version, idempotencyKey: randomUUID() };
    const { document: approved } = await supplier.documents.signDocument(request);
    await customer.documents.signDocument({
      ...request, expectedVersion: required(approved, 'the approved document').version, idempotencyKey: randomUUID(),
    });
  }
};

for (const shipperSide of ['customer', 'supplier'] as const) {
  test(`runs an exchange trip and settles it with the ${shipperSide} paying for transport`, async ({ context, page }) => {
    const supplierPage = await context.newPage();
    const carrierPage = await context.newPage();
    const workers: DealWorkerRobotValue[] = [];
    const startWorker = async (workerPage: Page, actingContext: WorkerActingContextValue): Promise<DealWorkerRobotValue> => {
      const worker = await createDealWorkerRobot(workerPage, actingContext);
      workers.push(worker);
      await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
      return worker;
    };
    const stopWorkers = async (): Promise<void> => {
      for (const worker of workers.splice(0).reverse()) {
        await worker.stop();
      }
    };
    let tripId: string;
    try {
      let customer = await startWorker(page, DEAL_CUSTOMER);
      let supplier = await startWorker(supplierPage, SUPPLIER);
      let carrier = await startWorker(carrierPage, CARRIER);
      let advance = await freezeEngineClock(page, supplierPage, carrierPage);
      const shipper = shipperSide === 'customer' ? customer : supplier;
      const otherParty = shipperSide === 'customer' ? supplier : customer;
      const salesTerms = required((await supplier.catalog.getSalesTerms({})).terms, 'the sales terms');
      await supplier.catalog.saveSalesTerms({
        expectedVersion: salesTerms.version,
        idempotencyKey: randomUUID(),
        isAutoConfirmEnabled: false,
        ownDelivery: salesTerms.ownDelivery,
        preparationWorkingDays: salesTerms.preparationWorkingDays,
      });
      const deal = await agreeDeal(customer, supplier);
      const dealId = deal.id;
      const goods = required(deal.goodsTotal, 'the goods total').amountMinor;
      const { transportRequest } = await shipper.logistics.publishTransportRequest({
        cargo: {
          bodyTypes: [VehicleBodyType.REFRIGERATED],
          cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED,
          heightMillimeters: 1000,
          lengthMillimeters: 1200,
          palletPlaces: 1,
          temperature: { maxCelsius: 4, minCelsius: 2 },
          volumeCubicCentimeters: 960_000n,
          weightGrams: 300_000n,
          widthMillimeters: 800,
        },
        dealId,
        deliveryWindow: {
          endsAt: timestampFromMs(Date.UTC(2026, 9, 13, 7, 30)),
          startsAt: timestampFromMs(Date.UTC(2026, 9, 13, 7, 5)),
        },
        expectedVersion: deal.version,
        idempotencyKey: randomUUID(),
        pickupWindow: {
          endsAt: timestampFromMs(Date.UTC(2026, 9, 13, 6, 30)),
          startsAt: timestampFromMs(Date.UTC(2026, 9, 13, 6, 5)),
        },
      });
      const request = required(transportRequest, 'the published request');
      tripId = required(request.summary, 'the request summary').id;
      if (request.perspective.case !== 'deal') {
        throw new Error('Expected the shipper perspective');
      }
      const open = await carrier.logistics.getTransportRequest({ transportRequestId: tripId });
      expect(open.transportRequest?.perspective.case).toBe('carrier');
      await expectHidden(carrier.logistics.getTrip({ tripId }));
      const { offer } = await carrier.logistics.submitTransportOffer({
        amount: RATE, idempotencyKey: randomUUID(), transportRequestId: tripId,
      });
      await shipper.logistics.selectTransportOffer({
        confirmedAmount: RATE,
        expectedVersion: request.perspective.value.version,
        idempotencyKey: randomUUID(),
        transportOfferId: required(offer, 'the offer').id,
        transportRequestId: tripId,
      });
      const { trip: draftTrip } = await carrier.logistics.getTrip({ tripId });
      expect(draftTrip).toMatchObject({ status: TripStatus.AWAITING_CONFIRMATION, transportOrder: { amount: RATE } });
      expect((await otherParty.logistics.getTrip({ tripId })).trip?.transportOrder).toBeUndefined();
      await expectHidden(carrier.deals.getDeal({ dealId }));
      await expectHidden(carrier.documents.listDealDocuments({ dealId }));

      const { trip: confirmed } = await carrier.logistics.confirmTransportOrder({
        expectedVersion: required(draftTrip, 'the trip draft').version, idempotencyKey: randomUUID(), tripId,
      });
      const assignment = {
        departureAt: timestampFromMs(Date.UTC(2026, 9, 13, 6, 15)),
        driverId: DRIVER_ID,
        expectedVersion: required(confirmed, 'the confirmed trip').version,
        idempotencyKey: randomUUID(),
        tripId,
        vehicleId: VEHICLE_ID,
      };
      const assigned = await carrier.logistics.assignTrip(assignment);
      expect(assigned.trip).toMatchObject({ status: TripStatus.ASSIGNED });
      expect(await carrier.logistics.assignTrip(assignment)).toEqual(assigned);
      expect((await customer.logistics.getTrip({ tripId })).trip?.ownAssignment).toBeUndefined();

      await signGoodsDocuments(customer, supplier, dealId);
      const { payment } = await customer.payments.getDealPayment({ dealId });
      const amountMinor = shipperSide === 'customer' ? goods + RATE.amountMinor : goods;
      const total = { amountMinor, currencyCode: 'RUB' };
      expect(payment).toMatchObject({ fundedAmount: total, status: SafeDealPaymentStatus.INVOICED });
      await customer.payments.fundDeal({
        amount: total, dealId, expectedVersion: required(payment, 'the invoiced payment').version, idempotencyKey: randomUUID(),
      });
      if (shipperSide === 'customer') {
        await stopWorkers();
        customer = await startWorker(page, DEAL_CUSTOMER);
        supplier = await startWorker(supplierPage, SUPPLIER);
        carrier = await startWorker(carrierPage, CARRIER);
        advance = await freezeEngineClock(page, supplierPage, carrierPage);
        expect((await customer.payments.getDealPayment({ dealId })).payment).toMatchObject({
          fundedAmount: total,
          status: SafeDealPaymentStatus.AWAITING_FUNDS,
        });
      }
      const readDeal = async (): Promise<Deal> => required((await supplier.deals.getDeal({ dealId })).deal, 'the running deal');
      await advance(5 * MINUTE_MS);
      await expect.poll(async () => (await readDeal()).status).toBe(DealStatus.PAID);
      await advance(24 * 60 * MINUTE_MS);
      await supplier.deals.markDealShipped({ dealId, expectedVersion: (await readDeal()).version, idempotencyKey: randomUUID() });
      await advance(16 * MINUTE_MS);
      await expect.poll(async () => (await carrier.logistics.getTrip({ tripId })).trip?.status).toBe(TripStatus.IN_TRANSIT);
      await advance(61 * MINUTE_MS);
      await expect.poll(async () => (await readDeal()).status).toBe(DealStatus.ARRIVED);
      if (shipperSide === 'customer') {
        await customer.deals.acceptDeal({ dealId, expectedVersion: (await readDeal()).version, idempotencyKey: randomUUID() });
      }
      else {
        await advance(2 * 24 * 60 * MINUTE_MS);
        await expect.poll(async () => {
          const { status } = await readDeal();
          return status === DealStatus.ACCEPTED || status === DealStatus.SETTLEMENT;
        }).toBe(true);
      }
      await advance(3 * MINUTE_MS);
      await expect.poll(async () => (await readDeal()).status).toBe(DealStatus.CLOSED);
      const { trip: closed } = await carrier.logistics.getTrip({ tripId });
      expect(closed).toMatchObject({
        carrierPayment: {
          carrierPayout: { amount: { amountMinor: 98_500n }, status: PayoutStatus.PAID },
          commissionAmount: { amountMinor: 1_500n },
          shippingAmount: RATE,
        },
        status: TripStatus.CLOSED,
      });
      const goodsCommission = (goods * 150n + 5_000n) / 10_000n;
      const supplierPayout = goods - goodsCommission - (shipperSide === 'supplier' ? RATE.amountMinor : 0n);
      const payer = shipperSide === 'customer' ? customer : supplier;
      const nonPayer = shipperSide === 'customer' ? supplier : customer;
      const { payment: settled } = await payer.payments.getDealPayment({ dealId });
      expect(settled?.payouts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          amount: expect.objectContaining({ amountMinor: supplierPayout }),
          organizationId: SUPPLIER.organizationId,
        }),
      ]));
      const { payment: hidden } = await nonPayer.payments.getDealPayment({ dealId });
      expect(hidden?.transport).toBeUndefined();
      expect(hidden?.payouts.some(payout => payout.organizationId === CARRIER.organizationId)).toBe(false);
    }
    finally {
      await stopWorkers();
      await carrierPage.close();
      await supplierPage.close();
    }

    const restored = await createDealWorkerRobot(page, CARRIER);
    try {
      await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
      expect((await restored.logistics.getTrip({ tripId })).trip).toMatchObject({
        carrierPayment: { carrierPayout: { amount: { amountMinor: 98_500n }, status: PayoutStatus.PAID } },
        status: TripStatus.CLOSED,
      });
    }
    finally {
      await restored.stop();
    }
  });
}
