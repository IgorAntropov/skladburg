import { create } from '@bufbuild/protobuf';
import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  CreateDealDraftRequestSchema,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedCityId,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/index';
import {
  createShowcaseListing,
  CUSTOMER_CALL,
} from '../catalog/showcase/testing/showcaseFixtures';
import {
  captureFailure,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import { createModuleHarness } from '../testing/moduleHarness';
import { createDealService } from './dealService';

const setup = async (): Promise<{
  client: ReturnType<typeof createClient<typeof DealService>>;
  harness: ReturnType<typeof createModuleHarness>;
  request: ReturnType<typeof create<typeof CreateDealDraftRequestSchema>>;
}> => {
  const harness = createModuleHarness();
  const client = createClient(DealService, createRouterTransport(({ service }) => {
    service(DealService, createDealService(harness.runtime));
  }));
  const { listing } = await createShowcaseListing(harness);
  const request = create(CreateDealDraftRequestSchema, {
    dealId: nextUuid(),
    desiredDate: { day: 20, month: 10, year: 2026 },
    idempotencyKey: nextUuid(),
    lines: [{ listingId: listing.id, quantity: 10n }],
    shipFromCityId: SeedCityId.KRASNODAR,
    shipToWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    supplierOrganizationId: SeedOrganizationId.SUPPLIER_1,
  });
  harness.events.length = 0;
  return { client, harness, request };
};

describe('deal service', () => {
  it('keeps a draft and a draft cancellation private from the supplier', async () => {
    const { client, harness, request } = await setup();
    const created = await client.createDealDraft(request, CUSTOMER_CALL);
    expect(created.deal?.status).toBe(DealStatus.DRAFT);
    expect(created.deal?.goodsTotal?.amountMinor).toBe(90_000n);
    expect(harness.state.read.list('productLinks')).toHaveLength(1);
    expect((await client.listDeals({}, SUPPLIER_1_CALL)).deals).toHaveLength(0);
    expect((await captureFailure(client.getDeal({ dealId: request.dealId }, SUPPLIER_1_CALL))).code).toBe(ErrorCode.NOT_FOUND);
    const cancelled = await client.cancelDeal({ dealId: request.dealId,
      expectedVersion: 1,
      idempotencyKey: nextUuid(),
      reason: 'Передумали' },
    CUSTOMER_CALL);
    expect(cancelled.deal?.status).toBe(DealStatus.CANCELLED);
    expect((await client.listDeals({}, SUPPLIER_1_CALL)).deals).toHaveLength(0);
    expect(harness.events.filter(event => event.channel.includes(SeedOrganizationId.SUPPLIER_1))).toHaveLength(0);
  });

  it('submits, confirms and chooses pickup with immutable exact totals', async () => {
    const { client, harness, request } = await setup();
    const draft = await client.createDealDraft(request, CUSTOMER_CALL);
    const submitted = await client.submitDeal({ dealId: request.dealId,
      expectedVersion: 1,
      goodsTotal: draft.deal?.goodsTotal,
      idempotencyKey: nextUuid() },
    CUSTOMER_CALL);
    expect(submitted.deal?.status).toBe(DealStatus.SUBMITTED);
    expect((await client.listDeals({}, SUPPLIER_1_CALL)).deals).toHaveLength(1);
    const confirmed = await client.confirmDeal({ dealId: request.dealId,
      expectedVersion: 2,
      goodsTotal: draft.deal?.goodsTotal,
      idempotencyKey: nextUuid(),
      shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1 },
    SUPPLIER_1_CALL);
    expect(confirmed.deal?.status).toBe(DealStatus.AGREED);
    const chosen = await client.chooseDelivery({ dealId: request.dealId,
      deliveryMethod: DeliveryMethod.CUSTOMER,
      expectedVersion: 3,
      idempotencyKey: nextUuid() },
    CUSTOMER_CALL);
    expect(chosen.deal?.status).toBe(DealStatus.LOGISTICS_CHOSEN);
    expect(chosen.deal?.deliveryTotal?.amountMinor).toBe(0n);
    expect(harness.state.read.list('supplyContracts')).toHaveLength(1);
  });
});
