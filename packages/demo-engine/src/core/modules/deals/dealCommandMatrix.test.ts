import type {
  DescMessage,
  DescMethodUnary,
  JsonObject,
  MessageShape,
} from '@bufbuild/protobuf';
import type { CallOptions } from '@connectrpc/connect';

import {
  create,
  fromJson,
  toJson,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  CreateDealDraftRequestSchema,
  DealSchema,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { SUPPORT_SESSION_HEADER } from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessSessionSchema,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  captureFailure,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
} from '../testing/moduleHarness';
import {
  counterSubmittedDeal,
  createDealFixture,
  createSubmittedDeal,
} from './testing/dealFixtures';

interface CommandScenarioValue {
  method: DescMethodUnary;
  permission: string;
  side: 'customer' | 'supplier';
  stage: 'agreed' | 'draft' | 'new' | 'offered' | 'submitted';
}

const scenarios: CommandScenarioValue[] = [
  { method: DealService.method.createDealDraft, permission: 'deal_create', side: 'customer', stage: 'new' },
  { method: DealService.method.updateDealDraft, permission: 'deal_edit', side: 'customer', stage: 'draft' },
  { method: DealService.method.submitDeal, permission: 'deal_approve', side: 'customer', stage: 'draft' },
  { method: DealService.method.confirmDeal, permission: 'deal_approve', side: 'supplier', stage: 'submitted' },
  { method: DealService.method.counterDeal, permission: 'deal_edit', side: 'supplier', stage: 'submitted' },
  { method: DealService.method.acceptCounterOffer, permission: 'deal_approve', side: 'customer', stage: 'offered' },
  { method: DealService.method.rejectCounterOffer, permission: 'deal_edit', side: 'customer', stage: 'offered' },
  { method: DealService.method.rejectDeal, permission: 'deal_edit', side: 'supplier', stage: 'submitted' },
  { method: DealService.method.chooseDelivery, permission: 'deal_edit', side: 'customer', stage: 'agreed' },
  { method: DealService.method.cancelDeal, permission: 'deal_edit', side: 'customer', stage: 'draft' },
];

const setupScenario = async (scenario: CommandScenarioValue): Promise<{
  call: CallOptions;
  execute: (payload: JsonObject, options: CallOptions) => Promise<MessageShape<DescMessage>>;
  fixture: Awaited<ReturnType<typeof createDealFixture>>;
  json: JsonObject;
  organizationId: string;
}> => {
  const fixture = await createDealFixture();
  const { harness, request } = fixture;
  let deal = create(DealSchema);
  if (scenario.stage === 'draft') {
    deal = (await harness.deal.createDealDraft(request, CUSTOMER_CALL)).deal ?? deal;
  }
  if (scenario.stage === 'submitted' || scenario.stage === 'offered' || scenario.stage === 'agreed') {
    deal = await createSubmittedDeal(harness, request);
  }
  if (scenario.stage === 'offered') {
    deal = await counterSubmittedDeal(harness, deal);
  }
  if (scenario.stage === 'agreed') {
    deal = (await harness.deal.confirmDeal({ dealId: deal.id, expectedVersion: deal.version, goodsTotal: deal.goodsTotal,
      idempotencyKey: nextUuid(), shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1 }, SUPPLIER_1_CALL)).deal ?? deal;
  }
  const draftJson = toJson(CreateDealDraftRequestSchema, request);
  if (draftJson === null || typeof draftJson !== 'object' || Array.isArray(draftJson)) {
    throw new Error('Expected request JSON object');
  }
  const input: JsonObject = scenario.stage === 'new'
    ? draftJson
    : {
        dealId: deal.id, expectedVersion: deal.version, idempotencyKey: nextUuid(),
      };
  const name = scenario.method.localName;
  if (name === 'updateDealDraft') {
    Object.assign(input,
      { desiredDate: { day: 21,
        month: 10,
        year: 2026 },
      lines: request.lines.map(line => ({ listingId: line.listingId,
        quantity: '15' })),
      shipFromCityId: request.shipFromCityId, shipToWarehouseId: request.shipToWarehouseId });
  }
  if (name === 'submitDeal' || name === 'confirmDeal' || name === 'acceptCounterOffer') {
    const amountMinor = name === 'acceptCounterOffer' ? deal.counterOffer?.goodsTotal?.amountMinor : deal.goodsTotal?.amountMinor;
    input.goodsTotal = { amountMinor: String(amountMinor), currencyCode: 'RUB' };
  }
  if (name === 'confirmDeal' || name === 'counterDeal') {
    input.shipFromWarehouseId = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
  }
  if (name === 'counterDeal') {
    input.desiredDate = { day: 21, month: 10, year: 2026 };
    input.lines = deal.lines.map(line => ({ lineId: line.id, price: { amountMinor: '8500', currencyCode: 'RUB' }, quantity: '15' }));
  }
  if (name === 'rejectDeal' || name === 'rejectCounterOffer' || name === 'cancelDeal') {
    input.reason = 'Изменились условия';
  }
  if (name === 'chooseDelivery') {
    input.deliveryMethod = 'DELIVERY_METHOD_CUSTOMER';
  }
  const execute = async (payload: JsonObject, options: CallOptions): Promise<MessageShape<DescMessage>> =>
    (await harness.transport.unary(scenario.method,
      undefined,
      undefined,
      options.headers,
      fromJson(scenario.method.input,
        payload))).message;
  return {
    call: scenario.side === 'customer' ? CUSTOMER_CALL : SUPPLIER_1_CALL,
    execute, fixture, json: input,
    organizationId: scenario.side === 'customer' ? SeedOrganizationId.CUSTOMER_1 : SeedOrganizationId.SUPPLIER_1,
  };
};

describe('deal command permission and concurrency matrix', () => {
  it.each(scenarios)('$method.name is idempotent, rejects key reuse and stale versions', async (scenario) => {
    const { call, execute, json } = await setupScenario(scenario);
    const first = await execute(json, call);
    expect(await execute(json, call)).toEqual(first);
    expect((await captureFailure(execute({ ...json, expectedVersion: 123 }, call))).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect((await captureFailure(execute({ ...json,
      expectedVersion: 123,
      idempotencyKey: nextUuid() },
    call))).code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it.each(scenarios)('$method.name rejects missing permission, wrong side and third party', async (scenario) => {
    const { call, execute, fixture, json, organizationId } = await setupScenario(scenario);
    const userId = await addTestMember(fixture.harness, { organizationId, permissions: ['deal_view'], warehouseIds: [] });
    expect((await captureFailure(execute(json, callAs(userId, organizationId)))).code).toBe(ErrorCode.PERMISSION_DENIED);
    const wrongCall = scenario.side === 'customer' ? SUPPLIER_1_CALL : CUSTOMER_CALL;
    const wrong = await captureFailure(execute(json, wrongCall));
    expect([ErrorCode.PERMISSION_DENIED, ErrorCode.NOT_FOUND]).toContain(wrong.code);
    const thirdOrganizationId = SeedOrganizationId.CUSTOMER_2;
    const thirdUserId = await addTestMember(fixture.harness,
      { organizationId: thirdOrganizationId,
        permissions: [scenario.permission],
        warehouseIds: [] });
    expect((await captureFailure(execute(json, callAs(thirdUserId, thirdOrganizationId)))).code).toBe(ErrorCode.NOT_FOUND);
    expect(await execute(json, call)).toBeDefined();
  });

  it.each(scenarios)('$method.name rejects an active support edit session', async (scenario) => {
    const { execute, fixture, json, organizationId } = await setupScenario(scenario);
    const sessionId = nextUuid();
    await fixture.harness.runtime.command((transaction) => {
      transaction.put('supportAccessSessions', create(SupportAccessSessionSchema, {
        expiresAt: timestampFromMs(fixture.harness.runtime.getWorldTimeMs() + 60_000), id: sessionId,
        mode: SupportAccessMode.EDIT, organizationId, section: SupportAccessSection.ALL,
        staffUserId: SeedUserId.OPERATOR_SUPER_ADMIN_1, status: SupportAccessStatus.ACTIVE,
      }));
    });
    const options = callAs(SeedUserId.OPERATOR_SUPER_ADMIN_1, organizationId);
    const headers = new Headers(options.headers);
    headers.set(SUPPORT_SESSION_HEADER, sessionId);
    expect((await captureFailure(execute(json, { headers }))).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it.each([DealService.method.markDealShipped,
    DealService.method.acceptDeal])('rejects $name when the payment record is missing',
    async (method: DescMethodUnary) => {
      const { fixture } = await setupScenario(scenarios[0] ?? { method: DealService.method.createDealDraft,
        permission: 'deal_create',
        side: 'customer',
        stage: 'new' });
      const { harness, request } = fixture;
      const submitted = await createSubmittedDeal(harness, request);
      await harness.runtime.command((transaction) => {
        const deal = transaction.get('deals', request.dealId);
        if (deal !== undefined) {
          transaction.put('deals',
            create(DealSchema,
              { ...deal,
                deliveryMethod: DeliveryMethod.CUSTOMER,
                status: method === DealService.method.acceptDeal ? DealStatus.ARRIVED : DealStatus.PAID }));
        }
      });
      const organizationId = method === DealService.method.acceptDeal ? SeedOrganizationId.CUSTOMER_1 : SeedOrganizationId.SUPPLIER_1;
      const userId = await addTestMember(harness, { organizationId,
        permissions: [method === DealService.method.acceptDeal ? 'document_sign' : 'deal_edit'], warehouseIds: [] });
      const caller = callAs(userId, organizationId);
      const failure = await captureFailure(harness.transport.unary(method, undefined, undefined, caller.headers,
        create(method.input, { dealId: request.dealId, expectedVersion: submitted.version, idempotencyKey: nextUuid() })));
      expect(failure.code).toBe(ErrorCode.INTERNAL);
      expect(harness.state.read.get('deals', request.dealId)?.version).toBe(submitted.version);
    });
});
