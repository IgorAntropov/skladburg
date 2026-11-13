import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  DealDeadlinesSchema,
  DealReceiptSchema,
  DealStatus,
  ReceiptLineComparisonSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getFulfillmentMode } from './dealFulfillment';
import {
  getReceiptAction,
  shouldReadDealReceipt,
} from './dealReceiptActions';

const outgoing = create(DealReceiptSchema, { dealId: 'outgoing' });
const arriving = create(DealReceiptSchema, { dealId: 'arriving', updDocumentId: 'upd' });
const complete = create(DealReceiptSchema, { ...arriving, lines: [create(ReceiptLineComparisonSchema, { dealLineId: 'line' })] });
const discrepancy = create(DealReceiptSchema, { ...complete, hasDiscrepancies: true });
const claim = create(DealReceiptSchema, { ...discrepancy, claimDocumentId: 'claim' });

describe('warehouse fulfillment', () => {
  it('distinguishes warehouse picking and manual shipment at the paid stage', () => {
    const paid = { deadlines: undefined, status: DealStatus.PAID };
    expect(getFulfillmentMode('markDealShipped', paid, undefined, false)).toBeUndefined();
    expect(getFulfillmentMode('markDealShipped', paid, undefined, true)).toBe('manual');
    expect(getFulfillmentMode('markDealShipped', paid, outgoing, false)).toBe('warehouse');
    expect(getFulfillmentMode('markDealShipped', { ...paid, status: DealStatus.PICKING }, undefined, false)).toBe('warehouse');
  });

  it('reads the manual acceptance deadline independently of receipt document access', () => {
    const arrived = { deadlines: undefined, status: DealStatus.ARRIVED };
    const acceptanceDueAt = timestampFromMs(1);
    const deadlines = create(DealDeadlinesSchema, { acceptanceDueAt });
    expect(getFulfillmentMode('acceptDeal', arrived, undefined, false)).toBe('warehouse');
    expect(getFulfillmentMode('acceptDeal', { ...arrived, deadlines }, undefined, false)).toBe('manual');
  });

  it('reads receipt only for participants at fulfillment stages', () => {
    expect(shouldReadDealReceipt(DealStatus.PAID, 'customer')).toBe(false);
    expect(shouldReadDealReceipt(DealStatus.PAID, 'supplier')).toBe(true);
    expect(shouldReadDealReceipt(DealStatus.PICKING, 'customer')).toBe(true);
    expect(shouldReadDealReceipt(DealStatus.CLOSED, 'customer')).toBe(true);
    expect(shouldReadDealReceipt(DealStatus.ARRIVED, undefined)).toBe(false);
    expect(shouldReadDealReceipt(DealStatus.DRAFT, 'customer')).toBe(false);
  });
});

describe('receipt actions', () => {
  it('offers signature after completed fact only to the buyer', () => {
    expect(getReceiptAction(DealStatus.ARRIVED, 'customer', arriving)).toBeUndefined();
    expect(getReceiptAction(DealStatus.ACCEPTING, 'customer', complete)).toBe('confirmDealReceipt');
    expect(getReceiptAction(DealStatus.ACCEPTING, 'supplier', complete)).toBeUndefined();
    expect(getReceiptAction(DealStatus.ACCEPTED, 'customer', complete)).toBeUndefined();
  });

  it('opens the claim before partial signature, and hides completed signature', () => {
    expect(getReceiptAction(DealStatus.ACCEPTING, 'customer', discrepancy)).toBe('openDealReceiptClaim');
    expect(getReceiptAction(DealStatus.CLAIM, 'customer', discrepancy)).toBeUndefined();
    expect(getReceiptAction(DealStatus.CLAIM, 'customer', claim)).toBe('confirmDealReceipt');
    expect(getReceiptAction(DealStatus.CLAIM, 'customer', create(DealReceiptSchema, {
      ...claim,
      receiptTitleDocumentId: 'title',
    }))).toBeUndefined();
  });
});
