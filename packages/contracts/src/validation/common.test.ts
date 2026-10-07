import { create } from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MemberRequirementSchema,
  type MethodAccess,
  MethodAccessSchema,
  PermissionRequirementSchema,
  SessionRequirementSchema,
} from '../gen/common/v1/method_options_pb';
import { MoneySchema } from '../gen/common/v1/money_pb';
import { PageRequestSchema } from '../gen/common/v1/page_pb';
import { collectViolations } from './collectViolations';

const createPermissionAccess = (name: string, scopeField = '', limitField = ''): MethodAccess =>
  create(MethodAccessSchema, {
    requirement: {
      case: 'permission',
      value: create(PermissionRequirementSchema, {
        limitField,
        name,
        scopeField,
      }),
    },
  });

describe('Money', () => {
  it.each(['RUB', 'USD', 'EUR'])('accepts currency code %s', (currencyCode) => {
    const money = create(MoneySchema, { amountMinor: 125_000n, currencyCode });

    expect(collectViolations(MoneySchema, money)).toEqual([]);
  });

  it.each(['rub', 'RU', 'RUBL', 'R1B', ''])('rejects currency code "%s"', (currencyCode) => {
    const money = create(MoneySchema, { amountMinor: 100n, currencyCode });

    expect(collectViolations(MoneySchema, money)).toEqual([
      { fieldPath: 'currency_code', ruleId: 'string.pattern' },
    ]);
  });

  it('accepts negative and large amounts in minor units', () => {
    const negative = create(MoneySchema, { amountMinor: -1n, currencyCode: 'RUB' });
    const large = create(MoneySchema, { amountMinor: 9_007_199_254_740_993n, currencyCode: 'RUB' });

    expect(collectViolations(MoneySchema, negative)).toEqual([]);
    expect(collectViolations(MoneySchema, large)).toEqual([]);
  });
});

describe('PageRequest', () => {
  it.each([0, 1, 50, 200])('accepts page size %i', (pageSize) => {
    const page = create(PageRequestSchema, { pageSize });

    expect(collectViolations(PageRequestSchema, page)).toEqual([]);
  });

  it('rejects page size below zero', () => {
    const page = create(PageRequestSchema, { pageSize: -1 });

    expect(collectViolations(PageRequestSchema, page)).toEqual([
      { fieldPath: 'page_size', ruleId: 'int32.gte_lte' },
    ]);
  });

  it('rejects page size above 200', () => {
    const page = create(PageRequestSchema, { pageSize: 201 });

    expect(collectViolations(PageRequestSchema, page)).toEqual([
      { fieldPath: 'page_size', ruleId: 'int32.gte_lte' },
    ]);
  });

  it('accepts a token of 1024 characters', () => {
    const page = create(PageRequestSchema, { pageToken: 'a'.repeat(1024) });

    expect(collectViolations(PageRequestSchema, page)).toEqual([]);
  });

  it('rejects a token longer than 1024 characters', () => {
    const page = create(PageRequestSchema, { pageToken: 'a'.repeat(1025) });

    expect(collectViolations(PageRequestSchema, page)).toEqual([
      { fieldPath: 'page_token', ruleId: 'string.max_len' },
    ]);
  });
});

describe('MethodAccess', () => {
  it('rejects an access without a requirement', () => {
    const access = create(MethodAccessSchema);

    expect(collectViolations(MethodAccessSchema, access)).toEqual([
      { fieldPath: 'requirement', ruleId: 'required' },
    ]);
  });

  it('accepts the member requirement', () => {
    const access = create(MethodAccessSchema, {
      requirement: { case: 'member', value: create(MemberRequirementSchema) },
    });

    expect(collectViolations(MethodAccessSchema, access)).toEqual([]);
  });

  it('accepts the session requirement', () => {
    const access = create(MethodAccessSchema, {
      requirement: { case: 'session', value: create(SessionRequirementSchema) },
    });

    expect(collectViolations(MethodAccessSchema, access)).toEqual([]);
  });

  it.each(['deal_approve', 'auto_order_approve', 'platform_dispute_approve', 'warehouse_view', 'stock2_export'])(
    'accepts permission name %s',
    (name) => {
      expect(collectViolations(MethodAccessSchema, createPermissionAccess(name))).toEqual([]);
    },
  );

  it.each(['deal', 'deal_approved', 'Deal_view', 'deal__view', 'deal_view_', 'view', '_deal_view', ''])(
    'rejects permission name "%s"',
    (name) => {
      expect(collectViolations(MethodAccessSchema, createPermissionAccess(name))).toEqual([
        { fieldPath: 'permission.name', ruleId: 'string.pattern' },
      ]);
    },
  );

  it('accepts a snake case scope field and limit field', () => {
    const access = createPermissionAccess('deal_approve', 'warehouse_id', 'amount_limit');

    expect(collectViolations(MethodAccessSchema, access)).toEqual([]);
  });

  it('rejects a scope field in camel case', () => {
    const access = createPermissionAccess('deal_approve', 'WarehouseId');

    expect(collectViolations(MethodAccessSchema, access)).toEqual([
      { fieldPath: 'permission.scope_field', ruleId: 'string.pattern' },
    ]);
  });

  it('rejects a limit field with a leading digit', () => {
    const access = createPermissionAccess('deal_approve', '', '1limit');

    expect(collectViolations(MethodAccessSchema, access)).toEqual([
      { fieldPath: 'permission.limit_field', ruleId: 'string.pattern' },
    ]);
  });
});
