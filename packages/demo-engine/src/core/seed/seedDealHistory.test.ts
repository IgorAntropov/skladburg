import { timestampMs } from '@bufbuild/protobuf/wkt';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  PayoutStatus,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IDemoEngine } from '../engine/engineTypes';
import type {
  IEngineStorage,
  IRealTimeSource,
} from '../ports/index';

import { createEngineWithTasks } from '../engine/createEngine';
import { createDeferredPaymentTask } from '../modules/payments/loadPayments';
import { createEngineState } from '../state/index';
import { addSeedDealHistory } from './seedDealHistory';
import { SeedOrganizationId } from './seedIds';
import { createSeedSnapshot } from './seedSnapshot';

const createReplayEngine = (storage: IEngineStorage, realTime: IRealTimeSource): Promise<IDemoEngine> =>
  createEngineWithTasks({ epoch: 'seed-history-test', realTime, storage }, runtime => [createDeferredPaymentTask(runtime)]);

describe('addSeedDealHistory', () => {
  it('replays two paid orders per customer under a signed framework contract before the world starts', async () => {
    const seed = createSeedSnapshot();
    const withHistory = await addSeedDealHistory(seed, createReplayEngine);
    const { read } = createEngineState(withHistory);
    const deals = read.list('deals');
    const documents = read.list('documents');

    expect(deals).toHaveLength(4);
    expect(new Set(deals.flatMap(deal => deal.lines.map(line => line.listingId))).size).toBe(4);
    expect(read.list('supplyContracts')).toHaveLength(2);
    for (const [customerId, supplierId] of [
      [SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.SUPPLIER_6],
      [SeedOrganizationId.CUSTOMER_2, SeedOrganizationId.SUPPLIER_7],
    ]) {
      const orders = deals.filter(deal => deal.customerOrganizationId === customerId && deal.supplierOrganizationId === supplierId);
      expect(orders).toHaveLength(2);
      expect(new Set(orders.map(deal => deal.contractId)).size).toBe(1);
    }
    expect(documents).toHaveLength(10);
    expect(documents.filter(document => document.type === DocumentType.SUPPLY_CONTRACT)).toHaveLength(2);
    expect(documents.every(document => document.status === DocumentStatus.SIGNED && document.signatures.length === 2)).toBe(true);
    expect(read.list('documentNumbers').map(sequence => sequence.lastNumber).sort()).toEqual([1, 1, 2, 2, 2, 2]);

    for (const deal of deals) {
      expect(deal.status).toBe(DealStatus.CLOSED);
      expect(deal.updatedAt === undefined ? Infinity : timestampMs(deal.updatedAt)).toBeLessThan(seed.meta.worldTimeMs);
      const payment = read.get('payments', deal.id);
      expect(payment?.bankDueAt).toBeUndefined();
      expect(payment?.payment).toMatchObject({
        payouts: [{ organizationId: deal.supplierOrganizationId, status: PayoutStatus.PAID }],
        status: SafeDealPaymentStatus.CLOSED,
      });
    }
  });

  it('keeps the starting clock and notifications, advances the random state and replays deterministically', async () => {
    const seed = createSeedSnapshot();
    const withHistory = await addSeedDealHistory(seed, createReplayEngine);

    expect(withHistory).toEqual(await addSeedDealHistory(seed, createReplayEngine));
    expect(withHistory.meta).toMatchObject({
      channelSeq: seed.meta.channelSeq,
      schedulerDueAtMs: seed.meta.schedulerDueAtMs,
      timeScale: seed.meta.timeScale,
      worldTimeMs: seed.meta.worldTimeMs,
    });
    expect(withHistory.collections.listings).toEqual(seed.collections.listings);
    expect(withHistory.collections.memberships).toEqual(seed.collections.memberships);
    expect(withHistory.collections.notifications).toEqual(seed.collections.notifications);
    expect(withHistory.meta.randomState).not.toEqual(seed.meta.randomState);
    expect(seed.collections.deals.size).toBe(0);
  });
});
