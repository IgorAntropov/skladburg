import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import {
  CreateDealDraftRequestSchema,
  DealSchema,
} from '@skladburg/contracts/deal/v1/deal';

import type { ShowcaseListingOptionsValue } from '../../catalog/showcase/testing/showcaseFixtures';

import {
  SeedCityId,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../../seed/index';
import {
  createShowcaseListing,
  CUSTOMER_CALL,
} from '../../catalog/showcase/testing/showcaseFixtures';
import {
  buildRub,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../../catalog/testing/catalogFixtures';
import { createModuleHarness } from '../../testing/moduleHarness';

export const createDealFixture = async (options: ShowcaseListingOptionsValue = {}): Promise<{
  harness: ReturnType<typeof createModuleHarness>;
  request: ReturnType<typeof create<typeof CreateDealDraftRequestSchema>>;
}> => {
  const harness = createModuleHarness();
  const { listing } = await createShowcaseListing(harness, options);
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
  return { harness, request };
};

export const createSubmittedDeal = async (
  harness: ReturnType<typeof createModuleHarness>,
  request: ReturnType<typeof create<typeof CreateDealDraftRequestSchema>>,
): Promise<Deal> => {
  const { deal } = await harness.deal.createDealDraft(request, CUSTOMER_CALL);
  const submitted = await harness.deal.submitDeal({
    dealId: request.dealId,
    expectedVersion: 1,
    goodsTotal: deal?.goodsTotal,
    idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  return submitted.deal ?? create(DealSchema);
};

export const counterSubmittedDeal = async (harness: ReturnType<typeof createModuleHarness>, deal: Deal): Promise<Deal> => {
  const response = await harness.deal.counterDeal({
    dealId: deal.id,
    desiredDate: deal.desiredDate,
    expectedVersion: deal.version,
    idempotencyKey: nextUuid(),
    lines: deal.lines.map(line => ({ lineId: line.id, price: buildRub(8500n), quantity: 15n })),
    reason: 'Другая партия',
    shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
  }, SUPPLIER_1_CALL);
  return response.deal ?? create(DealSchema);
};
