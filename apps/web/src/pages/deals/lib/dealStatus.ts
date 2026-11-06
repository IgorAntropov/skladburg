import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

import type { DealsMessageKeyValue } from '../i18n/dealsSection';

export const DEAL_STATUS_KEYS = {
  [DealStatus.ACCEPTED]: 'deals.status.accepted',
  [DealStatus.ACCEPTING]: 'deals.status.accepting',
  [DealStatus.AGREED]: 'deals.status.agreed',
  [DealStatus.ARRIVED]: 'deals.status.arrived',
  [DealStatus.AWAITING_LOGISTICS]: 'deals.status.awaitingLogistics',
  [DealStatus.AWAITING_PAYMENT]: 'deals.status.awaitingPayment',
  [DealStatus.CANCELLED]: 'deals.status.cancelled',
  [DealStatus.CLAIM]: 'deals.status.claim',
  [DealStatus.CLOSED]: 'deals.status.closed',
  [DealStatus.COUNTER_OFFERED]: 'deals.status.counterOffered',
  [DealStatus.DOCUMENTS_CONFIRMED]: 'deals.status.documentsConfirmed',
  [DealStatus.DRAFT]: 'deals.status.draft',
  [DealStatus.IN_TRANSIT]: 'deals.status.inTransit',
  [DealStatus.LOGISTICS_CHOSEN]: 'deals.status.logisticsChosen',
  [DealStatus.PAID]: 'deals.status.paid',
  [DealStatus.PICKING]: 'deals.status.picking',
  [DealStatus.REJECTED]: 'deals.status.rejected',
  [DealStatus.SETTLEMENT]: 'deals.status.settlement',
  [DealStatus.SHIPPED]: 'deals.status.shipped',
  [DealStatus.SUBMITTED]: 'deals.status.submitted',
  [DealStatus.UNSPECIFIED]: 'deals.status.unspecified',
} satisfies Record<DealStatus, DealsMessageKeyValue>;
