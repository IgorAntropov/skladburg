import { create } from '@bufbuild/protobuf';
import { EffectivePermissionSchema } from '@skladburg/contracts/access/v1/access';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { findDealApprovalLimit } from './dealApprovalLimit';

const request = create(MoneySchema, { amountMinor: 9_007_199_254_740_993n, currencyCode: 'RUB' });
const lowerLimit = create(MoneySchema, { amountMinor: request.amountMinor - 1n, currencyCode: 'RUB' });
const usdLimit = create(MoneySchema, { amountMinor: request.amountMinor * 2n, currencyCode: 'USD' });

const scopedUnlimited = create(EffectivePermissionSchema, { permission: 'deal_approve', warehouseIds: ['own-warehouse'] });
const organizationGrant = create(EffectivePermissionSchema, { isOrganizationWide: true, permission: 'deal_approve' });

describe('findDealApprovalLimit', () => {
  it('uses the matching currency and retains bigint precision', () => {
    expect(findDealApprovalLimit([
      { ...organizationGrant, amountLimit: lowerLimit },
      { ...organizationGrant, amountLimit: usdLimit },
      scopedUnlimited,
    ], request)).toBe(lowerLimit);
  });

  it('accepts the exact limit', () => {
    expect(findDealApprovalLimit([{ ...organizationGrant, amountLimit: request }], request)).toBeUndefined();
  });

  it('honors an unlimited organization grant', () => {
    expect(findDealApprovalLimit([{ ...organizationGrant, amountLimit: lowerLimit }, organizationGrant], request)).toBeUndefined();
  });

  it('reports an incompatible currency when no grant covers the request currency', () => {
    expect(findDealApprovalLimit([{ ...organizationGrant, amountLimit: usdLimit }], request)).toBe(usdLimit);
  });
});
