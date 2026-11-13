import type { DealReceipt } from '@skladburg/contracts/deal/v1/deal';

import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

export type DealReceiptActionValue = 'confirmDealReceipt' | 'openDealReceiptClaim';

type DealPartyValue = 'customer' | 'supplier' | undefined;

const RECEIPT_STATUSES: ReadonlySet<DealStatus> = new Set([
  DealStatus.ACCEPTED,
  DealStatus.ACCEPTING,
  DealStatus.ARRIVED,
  DealStatus.CLAIM,
  DealStatus.CLOSED,
  DealStatus.IN_TRANSIT,
  DealStatus.PICKING,
  DealStatus.SETTLEMENT,
  DealStatus.SHIPPED,
]);

export const shouldReadDealReceipt = (status: DealStatus, party: DealPartyValue): boolean =>
  party !== undefined && (RECEIPT_STATUSES.has(status) || (status === DealStatus.PAID && party === 'supplier'));

export const getReceiptAction = (
  status: DealStatus,
  party: DealPartyValue,
  receipt: DealReceipt,
): DealReceiptActionValue | undefined => {
  if (party !== 'customer' || receipt.lines.length === 0 || receipt.receiptTitleDocumentId !== undefined) {
    return undefined;
  }
  if (status === DealStatus.ACCEPTING) {
    return receipt.hasDiscrepancies ? 'openDealReceiptClaim' : 'confirmDealReceipt';
  }
  return status === DealStatus.CLAIM && receipt.claimDocumentId !== undefined ? 'confirmDealReceipt' : undefined;
};
