import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  AvailabilityStatus,
  SalesTermsSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  DealStatus,
  SubmitDealRequestSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  buildAvailability,
  buildRub,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import { createDealFixture } from '../deals/testing/dealFixtures';
import { runSupplierBots } from './index';

const enableAutoConfirm = async (harness: ModuleHarnessValue, organizationId: string): Promise<void> => {
  await harness.runtime.command((transaction) => {
    const terms = create(SalesTermsSchema, transaction.get('salesTerms', organizationId));
    transaction.put('salesTerms', { ...terms, isAutoConfirmEnabled: true, organizationId });
  });
};

const createSubmittedOrder = async (): Promise<{ deal: Deal; harness: ModuleHarnessValue }> => {
  const { harness, request } = await createDealFixture({
    price: { tiers: [{ minQuantity: 10n, price: buildRub(9000n) }, { minQuantity: 20n, price: buildRub(8000n) }] },
  });
  const { deal: draft } = await harness.deal.createDealDraft({
    ...request,
    dealId: harness.random.uuid(),
    idempotencyKey: harness.random.uuid(),
    lines: request.lines.map(line => ({ ...line, quantity: 25n })),
  }, CUSTOMER_CALL);
  const { deal } = await harness.deal.submitDeal(create(SubmitDealRequestSchema, {
    dealId: draft?.id,
    expectedVersion: draft?.version,
    goodsTotal: draft?.goodsTotal,
    idempotencyKey: harness.random.uuid(),
  }), CUSTOMER_CALL);
  if (deal === undefined) {
    throw new Error('Missing submitted deal');
  }
  return { deal, harness };
};

const runAtOffset = (harness: ModuleHarnessValue, offsetMs: number): Promise<void> => runSupplierBots({
  ...harness.runtime,
  getWorldTimeMs: () => harness.clock.now() + offsetMs,
});

describe('supplier bots', () => {
  it('responds at the delay boundary from the latest update, with the same result for the same seed', async () => {
    const run = async (): Promise<Deal | undefined> => {
      const { deal, harness } = await createSubmittedOrder();
      await enableAutoConfirm(harness, SeedOrganizationId.SUPPLIER_1);
      await harness.runtime.command((transaction) => {
        const updatedAt = timestampFromMs(transaction.worldTimeMs + 1000);
        transaction.put('deals', { ...deal, updatedAt });
      });

      await runAtOffset(harness, 60_999);
      expect(harness.runtime.read.get('deals', deal.id)?.status).toBe(DealStatus.SUBMITTED);

      await runAtOffset(harness, 61_000);
      const confirmed = harness.runtime.read.get('deals', deal.id);
      expect(confirmed).toMatchObject({
        shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
        status: DealStatus.AGREED,
        version: 3,
      });
      await runAtOffset(harness, 62_000);
      expect(harness.runtime.read.get('deals', deal.id)).toEqual(confirmed);
      return confirmed;
    };

    const first = await run();
    const second = await run();
    expect(second?.id).toBe(first?.id);
    expect(second?.transitions).toEqual(first?.transitions);
  });

  it('counters with the current price tier for the highest available quantity on the order step', async () => {
    const { deal, harness } = await createSubmittedOrder();
    await enableAutoConfirm(harness, SeedOrganizationId.SUPPLIER_1);
    await harness.runtime.command((transaction) => {
      const listing = transaction.get('listings', deal.lines[0]?.listingId ?? '');
      if (listing === undefined) {
        throw new Error('Missing listing');
      }
      transaction.put('listings', {
        ...listing,
        availability: [
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2, 0n, AvailabilityStatus.ON_ORDER),
          buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, 19n, AvailabilityStatus.LOW),
        ],
      });
    });

    await runAtOffset(harness, 60_000);

    const countered = harness.runtime.read.get('deals', deal.id);
    expect(countered).toMatchObject({
      counterOffer: {
        lines: [{ price: { amountMinor: 9000n }, quantity: 15n }],
        shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
      },
      status: DealStatus.COUNTER_OFFERED,
    });
    expect(countered?.lines[0]?.quantity).toBe(25n);
  });

  it('leaves an opted-out deal available for a manual response', async () => {
    const { deal, harness } = await createSubmittedOrder();
    await runAtOffset(harness, 60_000);
    expect(harness.runtime.read.get('deals', deal.id)).toEqual(deal);

    const confirmed = await harness.deal.confirmDeal({
      dealId: deal.id,
      expectedVersion: deal.version,
      goodsTotal: deal.goodsTotal,
      idempotencyKey: harness.random.uuid(),
      shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    }, SUPPLIER_1_CALL);
    expect(confirmed.deal?.status).toBe(DealStatus.AGREED);
  });

  it('leaves an enabled order submitted when no supplier member can approve it', async () => {
    const { deal, harness } = await createSubmittedOrder();
    await enableAutoConfirm(harness, SeedOrganizationId.SUPPLIER_1);
    await harness.runtime.command((transaction) => {
      transaction.delete('memberships', SeedMembershipId.ADMIN_2);
    });

    await runAtOffset(harness, 60_000);

    expect(harness.runtime.read.get('deals', deal.id)).toEqual(deal);
  });
});
