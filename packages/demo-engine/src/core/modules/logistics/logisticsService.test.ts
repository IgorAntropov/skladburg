import type { Client } from '@connectrpc/connect';
import type {
  CreateDealDraftRequest,
  Deal,
} from '@skladburg/contracts/deal/v1/deal';
import type { PublishTransportRequestRequest } from '@skladburg/contracts/logistics/v1/logistics';

import { create } from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentService,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  CarrierLaneSchema,
  DriverSchema,
  VehicleBodyType,
  VehicleCargoKind,
  VehicleSchema,
} from '@skladburg/contracts/fleet/v1/fleet';
import {
  LogisticsService,
  PublishTransportRequestRequestSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  PaymentService,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
  type TestEngineValue,
} from '../../engine/testing/engineHarness';
import {
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildRub,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import {
  createDealFixture,
  createSubmittedDeal,
} from '../deals/testing/dealFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  type ModuleHarnessValue,
  readErrorDetail,
} from '../testing/moduleHarness';
import { markTripShipped } from './tripLifecycle';

const CARRIER_ONE = callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1);
const CARRIER_TWO = callAs(SeedUserId.ADMIN_8, SeedOrganizationId.CARRIER_2);
const MINUTE_MS = 60_000;
const PICKUP_START = Date.UTC(2026, 9, 12, 7);
const INTERCITY_ARRIVAL = PICKUP_START + (570 + 400) * MINUTE_MS;
const AMOUNT = buildRub(75_000n);

const window = (startsAt: number, endsAt: number): PublishTransportRequestRequest['pickupWindow'] => ({
  $typeName: 'logistics.v1.TransportWindow',
  endsAt: timestampFromMs(endsAt),
  startsAt: timestampFromMs(startsAt),
});

interface DealFixtureValue {
  deal: Deal;
  draft: CreateDealDraftRequest;
  harness: ModuleHarnessValue;
  logistics: Client<typeof LogisticsService>;
  publish: PublishTransportRequestRequest;
}

interface RequestFixtureValue extends DealFixtureValue {
  createOffer: { amount: typeof AMOUNT; transportRequestId: string };
  id: string;
  version: number;
}

const agreeDeal = async (harness: ModuleHarnessValue, request: CreateDealDraftRequest): Promise<Deal> => {
  const submitted = await createSubmittedDeal(harness, request);
  const { deal } = await harness.deal.confirmDeal({
    dealId: submitted.id,
    expectedVersion: submitted.version,
    goodsTotal: submitted.goodsTotal,
    idempotencyKey: nextUuid(),
    shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
  }, SUPPLIER_1_CALL);
  if (deal === undefined) {
    throw new Error('Expected an agreed deal');
  }

  return deal;
};

const prepareDeal = async (): Promise<DealFixtureValue> => {
  const { harness, request } = await createDealFixture();
  const deal = await agreeDeal(harness, request);
  const publish = create(PublishTransportRequestRequestSchema, {
    cargo: {
      bodyTypes: [VehicleBodyType.REFRIGERATED],
      cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED,
      heightMillimeters: 250,
      lengthMillimeters: 400,
      palletPlaces: 1,
      temperature: { maxCelsius: 4, minCelsius: 2 },
      volumeCubicCentimeters: 20_000n,
      weightGrams: 10_000n,
      widthMillimeters: 300,
    },
    dealId: deal.id,
    deliveryWindow: window(Date.UTC(2026, 9, 12, 10), Date.UTC(2026, 9, 13, 20)),
    expectedVersion: deal.version,
    idempotencyKey: nextUuid(),
    pickupWindow: window(PICKUP_START, Date.UTC(2026, 9, 12, 12)),
  });

  return { deal, draft: request, harness, logistics: createClient(LogisticsService, harness.transport), publish };
};

const publishFixture = async (fixture: DealFixtureValue, caller = CUSTOMER_CALL): Promise<RequestFixtureValue> => {
  const { transportRequest } = await fixture.logistics.publishTransportRequest(fixture.publish, caller);
  const id = transportRequest?.summary?.id;
  if (id === undefined || transportRequest?.perspective.case !== 'deal') {
    throw new Error('Expected a deal-side transport request');
  }

  return {
    ...fixture,
    createOffer: { amount: AMOUNT, transportRequestId: id },
    id,
    version: transportRequest.perspective.value.version,
  };
};

const prepareRequest = async (caller = CUSTOMER_CALL): Promise<RequestFixtureValue> => publishFixture(await prepareDeal(), caller);

const selectFixture = async (fixture: RequestFixtureValue, caller = CUSTOMER_CALL): Promise<void> => {
  const { createOffer, id, logistics, version } = fixture;
  const { offer } = await logistics.submitTransportOffer({ ...createOffer, idempotencyKey: nextUuid() }, CARRIER_ONE);
  if (offer === undefined) {
    throw new Error('Expected a transport offer');
  }
  await logistics.selectTransportOffer({
    confirmedAmount: AMOUNT,
    expectedVersion: version,
    idempotencyKey: nextUuid(),
    transportOfferId: offer.id,
    transportRequestId: id,
  }, caller);
};

const tickAt = async (testEngine: TestEngineValue, worldTimeMs: number): Promise<void> => {
  const { timeScale, worldTimeMs: current } = testEngine.engine.getClockSnapshot();
  testEngine.realTime.advance(Math.ceil((worldTimeMs - current) / timeScale));
  await testEngine.engine.tick();
};

const prepareFundedTrip = async (): Promise<{
  dealId: string;
  deals: Client<typeof DealService>;
  fundedAmount: typeof AMOUNT;
  logistics: Client<typeof LogisticsService>;
  payments: Client<typeof PaymentService>;
  testEngine: TestEngineValue;
  tripId: string;
}> => {
  const fixture = await prepareDeal();
  const { deal, harness } = fixture;
  const testEngine = await createTestEngine({ storage: createSpyStorage(await harness.storage.load()) });
  const transport = createEngineTransport(testEngine.engine, true);
  const deals = createClient(DealService, transport);
  const documents = createClient(DocumentService, transport);
  const logistics = createClient(LogisticsService, transport);
  const payments = createClient(PaymentService, transport);
  const published = await publishFixture({ ...fixture, logistics });
  const tripId = published.id;
  const dealId = deal.id;
  await selectFixture(published);
  await logistics.confirmTransportOrder({ expectedVersion: 1, idempotencyKey: nextUuid(), tripId }, CARRIER_ONE);
  const vehicle = harness.state.read.listBy('vehicles', 'tenantId', SeedOrganizationId.CARRIER_1)
    .find(candidate => candidate.details?.availability.some(window => window.cityId === SeedCityId.KRASNODAR));
  const [driver] = harness.state.read.listBy('drivers', 'tenantId', SeedOrganizationId.CARRIER_1);
  if (vehicle === undefined || driver === undefined || deal.goodsTotal === undefined) {
    throw new Error('Expected goods total and fleet resources for the intercity trip');
  }
  await logistics.assignTrip({
    departureAt: timestampFromMs(PICKUP_START),
    driverId: driver.id,
    expectedVersion: 2,
    idempotencyKey: nextUuid(),
    tripId,
    vehicleId: vehicle.id,
  }, CARRIER_ONE);
  for (const document of (await documents.listDealDocuments({ dealId }, SUPPLIER_1_CALL)).documents) {
    const sign = document.type === DocumentType.SUPPLY_CONTRACT ? documents.signSupplyContract : documents.signDocument;
    await sign({ dealId, documentId: document.id, expectedVersion: 1, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    await sign({ dealId, documentId: document.id, expectedVersion: 2, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
  }
  const fundedAmount = buildRub(deal.goodsTotal.amountMinor + AMOUNT.amountMinor);
  await payments.fundDeal({ amount: fundedAmount, dealId, expectedVersion: 1, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
  await tickAt(testEngine, testEngine.engine.getClockSnapshot().worldTimeMs + 5 * MINUTE_MS);

  return { dealId, deals, fundedAmount, logistics, payments, testEngine, tripId };
};

describe('LogisticsService', () => {
  it('publishes from the supplier side without issuing documents and preserves the result on replay', async () => {
    const { deal, harness, logistics, publish } = await prepareDeal();
    const response = await logistics.publishTransportRequest(publish, SUPPLIER_1_CALL);
    const after = harness.state.read.get('deals', deal.id);
    expect(after).toMatchObject({ deliveryMethod: DeliveryMethod.EXCHANGE, status: DealStatus.AWAITING_LOGISTICS });
    expect(after?.deliveryTotal).toBeUndefined();
    expect(harness.state.read.listBy('documents', 'dealId', deal.id)).toEqual([]);
    expect(response.transportRequest?.perspective).toMatchObject({
      case: 'deal',
      value: { dealId: deal.id, shipperOrganizationId: SeedOrganizationId.SUPPLIER_1, version: 1 },
    });
    expect(await logistics.publishTransportRequest(publish, SUPPLIER_1_CALL)).toEqual(response);
    const duplicate = await captureError(logistics.publishTransportRequest({
      ...publish, expectedVersion: deal.version + 1, idempotencyKey: nextUuid(),
    }, SUPPLIER_1_CALL));
    expect(readErrorDetail(duplicate).code).toBe(ErrorCode.INVALID_TRANSITION);
  });

  it('shows compatible carriers only anonymous cargo and their own bid', async () => {
    const { createOffer, deal, harness, id, logistics } = await prepareRequest();
    const invalidations = (): string[] => harness.events
      .filter(event => event.payload.case === 'transportRequestChanged')
      .map(event => event.channel);
    expect(invalidations()).toContain(organizationChannel(SeedOrganizationId.CARRIER_1));
    expect(invalidations()).not.toContain(organizationChannel(SeedOrganizationId.CARRIER_2));
    const list = await logistics.listTransportRequests({}, CARRIER_ONE);
    expect(list.transportRequests).toHaveLength(1);
    expect(list.transportRequests[0]).toMatchObject({
      perspective: { case: 'carrier' },
      summary: { fromCityId: SeedCityId.KRASNODAR, id, toCityId: SeedCityId.MOSCOW },
    });
    expect(list.transportRequests[0]?.perspective.value).not.toHaveProperty('ownOffer');
    expect(JSON.stringify(list.transportRequests[0], (_, value: unknown) => typeof value === 'bigint' ? String(value) : value))
      .not.toContain(deal.id);
    expect((await logistics.listTransportRequests({}, CARRIER_TWO)).transportRequests).toEqual([]);
    const hidden = await captureError(logistics.getTransportRequest({ transportRequestId: id }, CARRIER_TWO));
    expect(readErrorDetail(hidden).code).toBe(ErrorCode.NOT_FOUND);
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CARRIER_1,
      permissions: ['fleet_view'],
      warehouseIds: [],
    });
    const denied = await captureError(logistics.listTransportRequests({}, callAs(userId, SeedOrganizationId.CARRIER_1)));
    expect(readErrorDetail(denied).code).toBe(ErrorCode.PERMISSION_DENIED);

    harness.events.length = 0;
    const input = { ...createOffer, idempotencyKey: nextUuid() };
    const { offer } = await logistics.submitTransportOffer(input, CARRIER_ONE);
    expect(await logistics.submitTransportOffer(input, CARRIER_ONE)).toMatchObject({ offer });
    expect(invalidations().sort()).toEqual([
      organizationChannel(SeedOrganizationId.CARRIER_1),
      organizationChannel(SeedOrganizationId.CUSTOMER_1),
    ].sort());
    const own = await logistics.getTransportRequest({ transportRequestId: id }, CARRIER_ONE);
    expect(own.transportRequest?.perspective).toMatchObject({ case: 'carrier', value: { ownOffer: offer } });
    expect((await logistics.listTransportOffers({ transportRequestId: id }, CUSTOMER_CALL)).candidates)
      .toMatchObject([{ isCompatible: true, offer }]);
    const hiddenOffers = await captureError(logistics.listTransportOffers({ transportRequestId: id }, CARRIER_ONE));
    expect(readErrorDetail(hiddenOffers).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('requires the shipper to select and records only one winner under concurrent commands', async () => {
    const { createOffer, deal, harness, id, logistics, version } = await prepareRequest(SUPPLIER_1_CALL);
    const { offer } = await logistics.submitTransportOffer({ ...createOffer, idempotencyKey: nextUuid() }, CARRIER_ONE);
    await harness.runtime.command((transaction) => {
      const [lane] = transaction.listBy('carrierLanes', 'tenantId', SeedOrganizationId.CARRIER_1);
      const [vehicle] = transaction.listBy('vehicles', 'tenantId', SeedOrganizationId.CARRIER_1);
      if (lane === undefined || vehicle === undefined) {
        throw new Error('Expected the first carrier fleet');
      }
      transaction.put('carrierLanes', create(CarrierLaneSchema, {
        ...lane, id: nextUuid(), tenantId: SeedOrganizationId.CARRIER_2,
      }));
      transaction.put('vehicles', create(VehicleSchema, {
        ...vehicle, id: nextUuid(), tenantId: SeedOrganizationId.CARRIER_2,
      }));
    });
    const cheaper = buildRub(70_000n);
    const alternative = await logistics.submitTransportOffer({
      ...createOffer, amount: cheaper, idempotencyKey: nextUuid(),
    }, CARRIER_TWO);
    const offers = await logistics.listTransportOffers({ transportRequestId: id }, SUPPLIER_1_CALL);
    expect(offers.candidates.map(candidate => candidate.offer?.id)).toEqual([alternative.offer?.id, offer?.id]);
    const select = {
      confirmedAmount: AMOUNT,
      expectedVersion: version,
      transportOfferId: offer?.id ?? '',
      transportRequestId: id,
    };
    const wrongSide = await captureError(logistics.selectTransportOffer({ ...select, idempotencyKey: nextUuid() }, CUSTOMER_CALL));
    expect(readErrorDetail(wrongSide).code).toBe(ErrorCode.PERMISSION_DENIED);
    const differentAmount = await captureError(logistics.selectTransportOffer({
      ...select, confirmedAmount: buildRub(1n), idempotencyKey: nextUuid(),
    }, SUPPLIER_1_CALL));
    expect(readErrorDetail(differentAmount).code).toBe(ErrorCode.VALIDATION_FAILED);

    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.SUPPLIER_1,
      permissions: ['transport_offer_approve'],
      warehouseIds: [],
    });
    await harness.runtime.command((transaction) => {
      const [member] = transaction.listBy('memberships', 'userId', userId);
      if (member === undefined) {
        throw new Error('Expected the shipper membership');
      }
      transaction.put('memberships', create(MembershipSchema, {
        ...member,
        roleAssignments: member.roleAssignments.map(assignment => ({ ...assignment, amountLimit: buildRub(1n) })),
      }));
    });
    const limitExceeded = await captureError(logistics.selectTransportOffer({
      ...select, confirmedAmount: buildRub(1n), idempotencyKey: nextUuid(),
    }, callAs(userId, SeedOrganizationId.SUPPLIER_1)));
    expect(readErrorDetail(limitExceeded).code).toBe(ErrorCode.LIMIT_EXCEEDED);

    const input = { ...select, idempotencyKey: nextUuid() };
    const [first, second] = await Promise.allSettled([
      logistics.selectTransportOffer(input, SUPPLIER_1_CALL),
      logistics.selectTransportOffer({
        ...input, confirmedAmount: cheaper, idempotencyKey: nextUuid(), transportOfferId: alternative.offer?.id ?? '',
      }, SUPPLIER_1_CALL),
    ]);
    expect(first).toMatchObject({ status: 'fulfilled', value: {
      transportRequest: {
        perspective: { case: 'deal', value: { selectedOffer: offer, version: version + 1 } },
        summary: { status: TransportRequestStatus.SELECTED },
      },
    } });
    expect(second.status).toBe('rejected');
    expect(harness.state.read.get('transportRequests', id)?.selectedOfferId).toBe(offer?.id);
    if (first.status === 'fulfilled') {
      expect(await logistics.selectTransportOffer(input, SUPPLIER_1_CALL)).toEqual(first.value);
    }
    expect(harness.state.read.get('deals', deal.id)?.status).toBe(DealStatus.AWAITING_LOGISTICS);
    expect(harness.state.read.listBy('documents', 'dealId', deal.id)).toEqual([]);

    const chosen = await logistics.getTransportRequest({ transportRequestId: id }, CARRIER_ONE);
    expect(chosen.transportRequest).toMatchObject({
      perspective: { case: 'carrier', value: { ownOffer: offer } },
      summary: { status: TransportRequestStatus.SELECTED },
    });
    const loser = await captureError(logistics.getTransportRequest({ transportRequestId: id }, CARRIER_TWO));
    expect(readErrorDetail(loser).code).toBe(ErrorCode.NOT_FOUND);
    const buyer = await logistics.getTransportRequest({ transportRequestId: id }, CUSTOMER_CALL);
    expect(buyer.transportRequest?.perspective.case).toBe('deal');
    expect(buyer.transportRequest?.perspective.value).not.toHaveProperty('selectedOffer');

    harness.events.length = 0;
    await harness.deal.cancelDeal({
      dealId: deal.id, expectedVersion: deal.version + 1, idempotencyKey: nextUuid(), reason: 'Отменили поставку',
    }, CUSTOMER_CALL);
    const cancelled = await logistics.getTransportRequest({ transportRequestId: id }, CARRIER_ONE);
    expect(cancelled.transportRequest).toMatchObject({
      perspective: { case: 'carrier', value: { ownOffer: offer } },
      summary: { status: TransportRequestStatus.CANCELLED },
    });
    const invalidations = harness.events.filter(event => event.payload.case === 'transportRequestChanged').map(event => event.channel);
    expect(invalidations).toContain(organizationChannel(SeedOrganizationId.CARRIER_1));
    expect(invalidations).not.toContain(organizationChannel(SeedOrganizationId.CARRIER_2));
  });

  it('rechecks availability at selection and closes the request atomically on deal cancellation', async () => {
    const { createOffer, deal, harness, id, logistics, version } = await prepareRequest();
    const { offer } = await logistics.submitTransportOffer({ ...createOffer, idempotencyKey: nextUuid() }, CARRIER_ONE);
    await harness.runtime.command((transaction) => {
      const lane = transaction.listBy('carrierLanes', 'tenantId', SeedOrganizationId.CARRIER_1)
        .find(value => value.fromCityId === SeedCityId.KRASNODAR);
      if (lane === undefined) {
        throw new Error('Expected a carrier lane');
      }
      transaction.put('carrierLanes', create(CarrierLaneSchema, { ...lane, isActive: false }));
    });
    const stale = await captureError(logistics.selectTransportOffer({
      confirmedAmount: AMOUNT,
      expectedVersion: version,
      idempotencyKey: nextUuid(),
      transportOfferId: offer?.id ?? '',
      transportRequestId: id,
    }, CUSTOMER_CALL));
    expect(readErrorDetail(stale).code).toBe(ErrorCode.VALIDATION_FAILED);
    const otherDelivery = await captureError(harness.deal.chooseDelivery({
      dealId: deal.id, deliveryMethod: DeliveryMethod.CUSTOMER, expectedVersion: deal.version + 1, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL));
    expect(readErrorDetail(otherDelivery).code).toBe(ErrorCode.VALIDATION_FAILED);
    await harness.deal.cancelDeal({
      dealId: deal.id, expectedVersion: deal.version + 1, idempotencyKey: nextUuid(), reason: 'Отменили поставку',
    }, SUPPLIER_1_CALL);
    const closed = await logistics.getTransportRequest({ transportRequestId: id }, CUSTOMER_CALL);
    expect(closed.transportRequest?.summary?.status).toBe(TransportRequestStatus.CANCELLED);
    expect(harness.state.read.get('deals', deal.id)?.status).toBe(DealStatus.CANCELLED);
    expect((await logistics.listTransportRequests({}, CARRIER_ONE)).transportRequests).toEqual([]);
  });

  it('keeps a supplier-paid offer open when it exceeds the amount available for settlement', async () => {
    const { createOffer, harness, id, logistics, version } = await prepareRequest(SUPPLIER_1_CALL);
    const amount = buildRub(89_000n);
    const { offer } = await logistics.submitTransportOffer({ ...createOffer, amount, idempotencyKey: nextUuid() }, CARRIER_ONE);
    const failure = await captureError(logistics.selectTransportOffer({
      confirmedAmount: amount,
      expectedVersion: version,
      idempotencyKey: nextUuid(),
      transportOfferId: offer?.id ?? '',
      transportRequestId: id,
    }, SUPPLIER_1_CALL));
    expect(readErrorDetail(failure).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(harness.state.read.get('transportRequests', id)?.status).toBe(TransportRequestStatus.OPEN);
    expect(harness.state.read.get('trips', id)).toBeUndefined();
  });

  it('creates one trip for a selected offer and lets only its carrier confirm the transport order', async () => {
    const fixture = await prepareRequest();
    const { deal, harness, id, logistics } = fixture;
    await selectFixture(fixture);
    const draft = await logistics.getTrip({ tripId: id }, CARRIER_ONE);
    expect(draft.trip).toMatchObject({ id, status: TripStatus.AWAITING_CONFIRMATION, version: 1 });
    const request = { expectedVersion: 1, idempotencyKey: nextUuid(), tripId: id };
    const outsider = await captureError(logistics.confirmTransportOrder(request, CARRIER_TWO));
    expect(readErrorDetail(outsider).code).toBe(ErrorCode.NOT_FOUND);
    expect((await logistics.listTrips({}, CARRIER_TWO)).trips).toEqual([]);

    const confirmed = await logistics.confirmTransportOrder(request, CARRIER_ONE);
    expect(confirmed.trip).toMatchObject({
      id,
      status: TripStatus.CONFIRMED,
      transportOrder: { amount: AMOUNT, confirmedByUserId: SeedUserId.ADMIN_4 },
      version: 2,
    });
    expect(await logistics.confirmTransportOrder(request, CARRIER_ONE)).toEqual(confirmed);
    const payer = await logistics.getTrip({ tripId: id }, CUSTOMER_CALL);
    expect(payer.trip?.transportOrder?.amount).toEqual(AMOUNT);
    expect(payer.trip?.transportOrder?.confirmedByUserId).toBe('');
    const supplier = await logistics.getTrip({ tripId: id }, SUPPLIER_1_CALL);
    expect(supplier.trip?.transportOrder).toBeUndefined();
    expect(harness.state.read.get('deals', deal.id)?.status).toBe(DealStatus.LOGISTICS_CHOSEN);
    const invoices = harness.state.read.listBy('documents', 'dealId', deal.id).filter(document => document.type === DocumentType.INVOICE);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.content?.terms).toMatchObject({ case: 'invoice', value: { deliveryTotal: buildRub(0n) } });
  });

  it('rejects simultaneous overlapping reservations and rechecks driver availability before shipment', async () => {
    const first = await prepareRequest();
    const { draft, harness, logistics } = first;
    const secondDeal = await agreeDeal(harness, { ...draft, dealId: nextUuid(), idempotencyKey: nextUuid() });
    const second = await publishFixture({
      ...first,
      deal: secondDeal,
      publish: { ...first.publish, dealId: secondDeal.id, expectedVersion: secondDeal.version, idempotencyKey: nextUuid() },
    });
    await selectFixture(first);
    await selectFixture(second);
    for (const { id } of [first, second]) {
      await logistics.confirmTransportOrder({ expectedVersion: 1, idempotencyKey: nextUuid(), tripId: id }, CARRIER_ONE);
    }
    const vehicle = harness.state.read.listBy('vehicles', 'tenantId', SeedOrganizationId.CARRIER_1)
      .find(candidate => candidate.details?.availability.some(window => window.cityId === SeedCityId.KRASNODAR));
    const [driver] = harness.state.read.listBy('drivers', 'tenantId', SeedOrganizationId.CARRIER_1);
    if (vehicle === undefined || driver === undefined) {
      throw new Error('Expected fleet resources at the departure city');
    }
    const departureAt = timestampFromMs(PICKUP_START);
    const assign = (tripId: string): ReturnType<typeof logistics.assignTrip> => logistics.assignTrip({
      departureAt, driverId: driver.id, expectedVersion: 2, idempotencyKey: nextUuid(), tripId, vehicleId: vehicle.id,
    }, CARRIER_ONE);
    const results = await Promise.allSettled([assign(first.id), assign(second.id)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const assigned = (await logistics.listTrips({}, CARRIER_ONE)).trips.find(trip => trip.status === TripStatus.ASSIGNED);
    if (assigned === undefined) {
      throw new Error('Expected one assigned trip');
    }
    expect(assigned.ownAssignment).toMatchObject({ departureAt, driverId: driver.id, vehicleId: vehicle.id });
    const customer = await logistics.getTrip({ tripId: assigned.id }, CUSTOMER_CALL);
    expect(customer.trip?.ownAssignment).toBeUndefined();

    const otherVehicleId = nextUuid();
    await harness.runtime.command((transaction) => {
      transaction.put('vehicles', create(VehicleSchema, { ...vehicle, id: otherVehicleId }));
    });
    const unassigned = assigned.id === first.id ? second.id : first.id;
    const overlappingDriver = await captureError(logistics.assignTrip({
      departureAt, driverId: driver.id, expectedVersion: 2, idempotencyKey: nextUuid(), tripId: unassigned, vehicleId: otherVehicleId,
    }, CARRIER_ONE));
    expect(readErrorDetail(overlappingDriver)).toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
      params: { case: 'validationFailed', value: { violations: [{ fieldPath: 'driver_id', ruleId: 'logistics.driver_reserved' }] } },
    });

    await harness.runtime.command((transaction) => {
      transaction.put('drivers', create(DriverSchema, { ...driver, isActive: false }));
    });
    const assignedDeal = assigned.id === first.id ? first.deal : second.deal;
    const invalidShipment = await captureError(
      harness.runtime.command((transaction) => {
        markTripShipped(harness.runtime, transaction, assignedDeal);
      }),
    );
    expect(readErrorDetail(invalidShipment).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(harness.state.read.get('trips', assigned.id)?.status).toBe(TripStatus.ASSIGNED);

    const currentDeal = harness.state.read.get('deals', assignedDeal.id);
    if (currentDeal === undefined) {
      throw new Error('Expected the current assigned deal');
    }
    await harness.deal.cancelDeal({
      dealId: currentDeal.id, expectedVersion: currentDeal.version, idempotencyKey: nextUuid(), reason: 'Отменили поставку',
    }, CUSTOMER_CALL);
    expect(harness.state.read.get('trips', assigned.id)?.status).toBe(TripStatus.CANCELLED);
    await harness.runtime.command((transaction) => {
      transaction.put('drivers', driver);
    });
    expect((await assign(unassigned)).trip?.status).toBe(TripStatus.ASSIGNED);
  });
});

describe('exchange trip through Connect', () => {
  it('moves the intercity deal from shipment to arrival at the scheduled world times', async () => {
    const { dealId, deals, logistics, testEngine, tripId } = await prepareFundedTrip();
    const readDeal = async (): Promise<Deal | undefined> => (await deals.getDeal({ dealId }, CUSTOMER_CALL)).deal;
    const paid = await readDeal();
    expect(paid?.status).toBe(DealStatus.PAID);
    await deals.markDealShipped({ dealId, expectedVersion: paid?.version ?? 0, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);

    const arrivalAt = timestampFromMs(INTERCITY_ARRIVAL);
    await tickAt(testEngine, PICKUP_START - MINUTE_MS);
    expect((await logistics.getTrip({ tripId }, CARRIER_ONE)).trip).toMatchObject({
      plannedArrivalAt: arrivalAt,
      status: TripStatus.LOADED,
    });
    expect(await readDeal()).toMatchObject({ deadlines: { arrivalDueAt: arrivalAt }, status: DealStatus.SHIPPED });
    expect((await readDeal())?.deadlines?.acceptanceDueAt).toBeUndefined();

    await tickAt(testEngine, PICKUP_START);
    expect((await logistics.getTrip({ tripId }, CARRIER_ONE)).trip).toMatchObject({
      departedAt: timestampFromMs(PICKUP_START), status: TripStatus.IN_TRANSIT,
    });
    expect((await readDeal())?.status).toBe(DealStatus.IN_TRANSIT);

    await tickAt(testEngine, INTERCITY_ARRIVAL - MINUTE_MS);
    expect((await logistics.getTrip({ tripId }, CARRIER_ONE)).trip?.status).toBe(TripStatus.IN_TRANSIT);
    expect((await readDeal())?.status).toBe(DealStatus.IN_TRANSIT);

    await tickAt(testEngine, INTERCITY_ARRIVAL);
    expect((await logistics.getTrip({ tripId }, CARRIER_ONE)).trip).toMatchObject({ arrivedAt: arrivalAt, status: TripStatus.ARRIVED });
    const arrived = await readDeal();
    expect(arrived).toMatchObject({ deadlines: { arrivalDueAt: arrivalAt }, status: DealStatus.ARRIVED });
    expect(timestampMs(arrived?.deadlines?.acceptanceDueAt ?? arrivalAt)).toBeGreaterThan(INTERCITY_ARRIVAL);
  });

  it('refunds all blocked funds on cancellation of an assigned trip without creating either payout', async () => {
    const { dealId, deals, fundedAmount, logistics, payments, testEngine, tripId } = await prepareFundedTrip();
    const { deal } = await deals.getDeal({ dealId }, CUSTOMER_CALL);
    expect(deal?.status).toBe(DealStatus.PAID);
    expect((await logistics.getTrip({ tripId }, CARRIER_ONE)).trip?.status).toBe(TripStatus.ASSIGNED);
    expect((await payments.getDealPayment({ dealId }, CUSTOMER_CALL)).payment).toMatchObject({
      fundedAmount, payouts: [], status: SafeDealPaymentStatus.BLOCKED,
    });

    const cancel = { dealId, expectedVersion: deal?.version ?? 0, idempotencyKey: nextUuid(), reason: 'Отменили поставку' };
    const cancelled = await deals.cancelDeal(cancel, CUSTOMER_CALL);
    expect(cancelled.deal?.status).toBe(DealStatus.CANCELLED);
    expect(await deals.cancelDeal(cancel, CUSTOMER_CALL)).toEqual(cancelled);
    await tickAt(testEngine, INTERCITY_ARRIVAL + MINUTE_MS);

    const { trip } = await logistics.getTrip({ tripId }, CARRIER_ONE);
    expect(trip).toMatchObject({ status: TripStatus.CANCELLED, version: 4 });
    expect(trip?.departedAt).toBeUndefined();
    expect(trip?.carrierPayment?.carrierPayout).toBeUndefined();
    const { payment } = await payments.getDealPayment({ dealId }, CUSTOMER_CALL);
    expect(payment).toMatchObject({ fundedAmount, payouts: [], status: SafeDealPaymentStatus.REFUNDED });
    expect(payment?.transitions.map(transition => transition.to)).toEqual([
      SafeDealPaymentStatus.AWAITING_FUNDS, SafeDealPaymentStatus.BLOCKED, SafeDealPaymentStatus.REFUNDED,
    ]);
  });
});
