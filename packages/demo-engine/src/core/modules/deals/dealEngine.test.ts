import {
  create,
  toJson,
} from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealSchema,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createEngine } from '../../engine/createEngine';
import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import { SeedOrganizationId } from '../../seed/index';
import { createEngineState } from '../../state/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  captureFailure,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import { createDealFixture } from './testing/dealFixtures';

const preparedEngine = async (): Promise<{
  request: Awaited<ReturnType<typeof createDealFixture>>['request'];
  test: Awaited<ReturnType<typeof createTestEngine>>;
}> => {
  const { harness, request } = await createDealFixture();
  const snapshot = await harness.storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing fixture snapshot');
  }
  return { request, test: await createTestEngine({ storage: createSpyStorage(snapshot) }) };
};

describe('deal engine integration', () => {
  it.each([true, false])('persists binary and JSON commands, privacy and idempotency across restart (%s)', async (isBinary) => {
    const { request, test: { engine, realTime, storage } } = await preparedEngine();
    const client = createClient(DealService, createEngineTransport(engine, isBinary));
    const created = await client.createDealDraft(request, CUSTOMER_CALL);
    const restarted = await createEngine({ epoch: 'deal-restart', realTime, storage });
    const restored = createClient(DealService, createEngineTransport(restarted, isBinary));
    expect(await restored.createDealDraft(request, CUSTOMER_CALL)).toEqual(created);
    expect((await restored.listDeals({}, SUPPLIER_1_CALL)).deals).toHaveLength(0);
    const submitted = await restored.submitDeal({
      dealId: request.dealId, expectedVersion: 1, goodsTotal: created.deal?.goodsTotal, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL);
    expect(submitted.deal?.status).toBe(DealStatus.SUBMITTED);
    const supplierDeal = (await restored.getDeal({ dealId: request.dealId }, SUPPLIER_1_CALL)).deal ?? create(DealSchema);
    const json = toJson(DealSchema, supplierDeal);
    expect(JSON.stringify(json)).not.toContain('PRIVATE-SKU');
    expect(supplierDeal.transitions[0]?.actorRoleName).toBe('');
    const snapshot = await storage.load();
    if (snapshot === undefined) {
      throw new Error('Missing persisted snapshot');
    }
    const state = createEngineState(snapshot);
    expect(state.read.list('deals')).toHaveLength(1);
    expect(state.read.list('supplyContracts')).toHaveLength(1);
    expect(state.read.list('productLinks')).toHaveLength(1);
  });

  it('rolls back every draft side effect when persistent storage rejects the commit', async () => {
    const { request, test: { engine, storage } } = await preparedEngine();
    const client = createClient(DealService, createEngineTransport(engine, true));
    const before = await storage.load();
    const events: string[] = [];
    engine.subscribe(organizationChannel(SeedOrganizationId.CUSTOMER_1),
      new Headers(CUSTOMER_CALL.headers),
      batch => events.push(...batch.map(event => event.channel)));
    engine.subscribe(organizationChannel(SeedOrganizationId.SUPPLIER_1),
      new Headers(SUPPLIER_1_CALL.headers),
      batch => events.push(...batch.map(event => event.channel)));
    storage.failNextCommit();
    expect((await captureFailure(client.createDealDraft(request, CUSTOMER_CALL))).code).toBe(ErrorCode.UNAVAILABLE);
    expect(await storage.load()).toEqual(before);
    expect((await client.listDeals({}, CUSTOMER_CALL)).deals).toHaveLength(0);
    expect(events).toHaveLength(0);
    const created = await client.createDealDraft(request, CUSTOMER_CALL);
    expect(created.deal?.number).toBe(1001);
    expect(await client.createDealDraft(request, CUSTOMER_CALL)).toEqual(created);
    const after = await storage.load();
    if (after === undefined) {
      throw new Error('Missing persisted snapshot');
    }
    const state = createEngineState(after);
    expect(state.read.list('supplyContracts')).toHaveLength(1);
    expect(state.read.list('productLinks')).toHaveLength(1);
  });
});
