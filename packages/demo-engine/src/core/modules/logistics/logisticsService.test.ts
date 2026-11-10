import type { Client } from '@connectrpc/connect';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { PublishTransportRequestRequest } from '@skladburg/contracts/logistics/v1/logistics';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  CarrierLaneSchema,
  VehicleBodyType,
  VehicleCargoKind,
  VehicleSchema,
} from '@skladburg/contracts/fleet/v1/fleet';
import {
  LogisticsService,
  PublishTransportRequestRequestSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

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

const CARRIER_ONE = callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1);
const CARRIER_TWO = callAs(SeedUserId.ADMIN_8, SeedOrganizationId.CARRIER_2);
const PICKUP_START = Date.UTC(2026, 9, 12, 7);
const AMOUNT = buildRub(7_500_000n);

const window = (startsAt: number, endsAt: number): PublishTransportRequestRequest['pickupWindow'] => ({
  $typeName: 'logistics.v1.TransportWindow',
  endsAt: timestampFromMs(endsAt),
  startsAt: timestampFromMs(startsAt),
});

interface DealFixtureValue {
  deal: Deal;
  harness: ModuleHarnessValue;
  logistics: Client<typeof LogisticsService>;
  publish: PublishTransportRequestRequest;
}

interface RequestFixtureValue extends DealFixtureValue {
  createOffer: { amount: typeof AMOUNT; transportRequestId: string };
  id: string;
  version: number;
}

const prepareDeal = async (): Promise<DealFixtureValue> => {
  const { harness, request } = await createDealFixture();
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

  return { deal, harness, logistics: createClient(LogisticsService, harness.transport), publish };
};

const prepareRequest = async (caller = CUSTOMER_CALL): Promise<RequestFixtureValue> => {
  const fixture = await prepareDeal();
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
    const cheaper = buildRub(7_000_000n);
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
});
