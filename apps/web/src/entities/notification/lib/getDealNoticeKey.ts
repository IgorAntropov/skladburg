import { DealNotice } from '@skladburg/contracts/notification/v1/notification';

const DEAL_NOTICE_KEYS = {
  [DealNotice.ACCEPTANCE_DUE]: 'deal.acceptanceDue',
  [DealNotice.ACCEPTED]: 'deal.accepted',
  [DealNotice.ARRIVED]: 'deal.arrived',
  [DealNotice.CANCELLED]: 'deal.cancelled',
  [DealNotice.CONFIRMATION_DUE]: 'deal.confirmationDue',
  [DealNotice.CONFIRMED]: 'deal.confirmed',
  [DealNotice.COUNTER_OFFER_DUE]: 'deal.counterOfferDue',
  [DealNotice.COUNTER_OFFERED]: 'deal.counterOffered',
  [DealNotice.DOCUMENTS_READY]: 'deal.documentsReady',
  [DealNotice.FUNDS_BLOCKED]: 'deal.fundsBlocked',
  [DealNotice.PAID_OUT]: 'deal.paidOut',
  [DealNotice.RECEIVED]: 'deal.received',
  [DealNotice.REJECTED]: 'deal.rejected',
  [DealNotice.SHIPPED]: 'deal.shipped',
  [DealNotice.UNSPECIFIED]: 'unknown',
} as const satisfies Record<DealNotice, string>;

type DealNoticeKeyValue = typeof DEAL_NOTICE_KEYS[DealNotice];

export const getDealNoticeKey = (notice: DealNotice): DealNoticeKeyValue =>
  Object.hasOwn(DEAL_NOTICE_KEYS, notice) ? DEAL_NOTICE_KEYS[notice] : 'unknown';
