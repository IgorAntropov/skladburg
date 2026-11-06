import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';

import type { TestRuntimeValue } from '../../testing/testRuntime';

import {
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../../seed/index';
import { withoutNotifications } from '../../notifications/testing/notificationFixtures';
import { createTestRuntime } from '../../testing/testRuntime';

export const EFFECTS_DEAL_ID = 'da000001-0000-4000-8000-000000000000';

export const createEffectsDeal = (status: DealStatus = DealStatus.DRAFT): Deal => create(DealSchema, {
  customerOrganizationId: SeedOrganizationId.CUSTOMER_1,
  id: EFFECTS_DEAL_ID,
  number: 1,
  shipToWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
  status,
  submittedAt: status === DealStatus.DRAFT ? undefined : timestampFromMs(SEED_WORLD_START_MS),
  supplierOrganizationId: SeedOrganizationId.SUPPLIER_1,
  version: 1,
});

export const createEffectsHarness = async (deal: Deal): Promise<TestRuntimeValue> => {
  const harness = await withoutNotifications(createTestRuntime());

  await harness.runtime.command((transaction) => {
    transaction.put('deals', deal);
  });
  harness.events.length = 0;
  harness.commits.length = 0;

  return harness;
};
