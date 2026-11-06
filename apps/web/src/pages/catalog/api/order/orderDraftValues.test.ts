import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildCreateDealDraft,
  parseOrderDate,
} from './orderDraftValues';

describe('order draft values', () => {
  it('preserves the exact base quantity and carries both IDs and version zero into the draft', () => {
    expect(buildCreateDealDraft({
      dealId: 'deal',
      idempotencyKey: 'attempt',
      listingId: 'listing',
      supplierOrganizationId: 'supplier',
    }, {
      desiredDate: '2028-02-29',
      quantity: 9_007_199_254_740_993n,
      shipFromCityId: 'city',
      shipToWarehouseId: 'warehouse',
    })).toEqual({
      dealId: 'deal',
      desiredDate: { day: 29, month: 2, year: 2028 },
      expectedVersion: 0,
      idempotencyKey: 'attempt',
      lines: [{ listingId: 'listing', quantity: 9_007_199_254_740_993n }],
      shipFromCityId: 'city',
      shipToWarehouseId: 'warehouse',
      supplierOrganizationId: 'supplier',
    });
  });

  it.each(['', '2027-02-29', '2026-04-31', '2026-00-01', '2026-11-00', '2101-01-01'])('rejects invalid date %s', (date) => {
    expect(parseOrderDate(date)).toBeUndefined();
  });
});
