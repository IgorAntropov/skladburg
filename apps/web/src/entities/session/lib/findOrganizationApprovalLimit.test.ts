import { create } from '@bufbuild/protobuf';
import { EffectivePermissionSchema } from '@skladburg/contracts/access/v1/access';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { findOrganizationApprovalLimit } from './findOrganizationApprovalLimit';

const request = create(MoneySchema, { amountMinor: 9_007_199_254_740_993n, currencyCode: 'RUB' });
const lowerLimit = create(MoneySchema, { amountMinor: request.amountMinor - 1n, currencyCode: 'RUB' });
const usdLimit = create(MoneySchema, { amountMinor: request.amountMinor * 2n, currencyCode: 'USD' });

const scopedUnlimited = create(EffectivePermissionSchema, { permission: 'deal_approve', warehouseIds: ['own-warehouse'] });
const organizationGrant = create(EffectivePermissionSchema, { isOrganizationWide: true, permission: 'deal_approve' });

describe('findOrganizationApprovalLimit', () => {
  it('uses the matching currency and retains bigint precision', () => {
    expect(findOrganizationApprovalLimit([
      { ...organizationGrant, amountLimit: lowerLimit },
      { ...organizationGrant, amountLimit: usdLimit },
      scopedUnlimited,
    ], request, 'deal_approve')).toBe(lowerLimit);
  });

  it('accepts the exact limit', () => {
    expect(findOrganizationApprovalLimit([{ ...organizationGrant, amountLimit: request }], request, 'deal_approve')).toBeUndefined();
  });

  it('honors an unlimited organization grant', () => {
    expect(findOrganizationApprovalLimit([
      { ...organizationGrant, amountLimit: lowerLimit }, organizationGrant,
    ], request, 'deal_approve')).toBeUndefined();
  });

  it('reports an incompatible currency when no grant covers the request currency', () => {
    expect(findOrganizationApprovalLimit([{ ...organizationGrant, amountLimit: usdLimit }], request, 'deal_approve')).toBe(usdLimit);
  });

  it('ignores unrelated grants when choosing a transport offer', () => {
    expect(findOrganizationApprovalLimit([
      { ...organizationGrant, amountLimit: lowerLimit, permission: 'transport_offer_approve' }, organizationGrant,
    ], request, 'transport_offer_approve')).toBe(lowerLimit);
  });
});
