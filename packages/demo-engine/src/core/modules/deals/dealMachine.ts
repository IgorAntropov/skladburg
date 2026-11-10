import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

import { createStateMachine } from '../../machine/index';

export interface DealMachineTransitionValue {
  permission: string;
  side: 'customer' | 'either' | 'supplier' | 'system';
  status: DealStatus;
}

const transition = (
  status: DealStatus,
  side: DealMachineTransitionValue['side'],
  permission: string,
): DealMachineTransitionValue => ({ permission, side, status });

export const DEAL_TRANSITIONS = {
  acceptCounterOffer: { [DealStatus.COUNTER_OFFERED]: transition(DealStatus.AGREED, 'customer', 'deal_approve') },
  acceptDeal: {
    [DealStatus.ACCEPTING]: transition(DealStatus.ACCEPTED, 'customer', 'document_sign'),
    [DealStatus.ARRIVED]: transition(DealStatus.ACCEPTED, 'customer', 'document_sign'),
  },
  arrive: { [DealStatus.IN_TRANSIT]: transition(DealStatus.ARRIVED, 'system', '') },
  autoAccept: {
    [DealStatus.ACCEPTING]: transition(DealStatus.ACCEPTED, 'system', ''),
    [DealStatus.ARRIVED]: transition(DealStatus.ACCEPTED, 'system', ''),
  },
  cancelDeal: {
    ...Object.fromEntries([
      DealStatus.DRAFT, DealStatus.SUBMITTED, DealStatus.COUNTER_OFFERED, DealStatus.AGREED,
      DealStatus.AWAITING_LOGISTICS, DealStatus.LOGISTICS_CHOSEN, DealStatus.DOCUMENTS_CONFIRMED, DealStatus.AWAITING_PAYMENT,
    ].map(status => [status, transition(DealStatus.CANCELLED, 'either', 'deal_edit')])),
    [DealStatus.PAID]: transition(DealStatus.CANCELLED, 'customer', 'deal_edit'),
    [DealStatus.PICKING]: transition(DealStatus.CANCELLED, 'customer', 'deal_edit'),
  },
  chooseDelivery: {
    [DealStatus.AGREED]: transition(DealStatus.LOGISTICS_CHOSEN, 'customer', 'deal_edit'),
    [DealStatus.AWAITING_LOGISTICS]: transition(DealStatus.LOGISTICS_CHOSEN, 'customer', 'deal_edit'),
  },
  close: { [DealStatus.SETTLEMENT]: transition(DealStatus.CLOSED, 'system', '') },
  confirmDeal: { [DealStatus.SUBMITTED]: transition(DealStatus.AGREED, 'supplier', 'deal_approve') },
  confirmDocuments: { [DealStatus.LOGISTICS_CHOSEN]: transition(DealStatus.DOCUMENTS_CONFIRMED, 'system', '') },
  counterDeal: { [DealStatus.SUBMITTED]: transition(DealStatus.COUNTER_OFFERED, 'supplier', 'deal_edit') },
  fund: { [DealStatus.AWAITING_PAYMENT]: transition(DealStatus.PAID, 'system', '') },
  markDealShipped: {
    [DealStatus.PAID]: transition(DealStatus.SHIPPED, 'supplier', 'deal_edit'),
    [DealStatus.PICKING]: transition(DealStatus.SHIPPED, 'supplier', 'deal_edit'),
  },
  openClaim: { [DealStatus.ACCEPTING]: transition(DealStatus.CLAIM, 'customer', 'claim_create') },
  publishTransportRequest: { [DealStatus.AGREED]: transition(DealStatus.AWAITING_LOGISTICS, 'either', 'transport_request_create') },
  rejectCounterOffer: { [DealStatus.COUNTER_OFFERED]: transition(DealStatus.REJECTED, 'customer', 'deal_edit') },
  rejectDeal: { [DealStatus.SUBMITTED]: transition(DealStatus.REJECTED, 'supplier', 'deal_edit') },
  requestPayment: { [DealStatus.DOCUMENTS_CONFIRMED]: transition(DealStatus.AWAITING_PAYMENT, 'system', '') },
  resolveClaim: { [DealStatus.CLAIM]: transition(DealStatus.ACCEPTED, 'system', '') },
  settle: { [DealStatus.ACCEPTED]: transition(DealStatus.SETTLEMENT, 'system', '') },
  startAccepting: { [DealStatus.ARRIVED]: transition(DealStatus.ACCEPTING, 'system', '') },
  startPicking: { [DealStatus.PAID]: transition(DealStatus.PICKING, 'system', '') },
  startTransit: { [DealStatus.SHIPPED]: transition(DealStatus.IN_TRANSIT, 'system', '') },
  submitDeal: { [DealStatus.DRAFT]: transition(DealStatus.SUBMITTED, 'customer', 'deal_approve') },
  updateDealDraft: { [DealStatus.DRAFT]: transition(DealStatus.DRAFT, 'customer', 'deal_edit') },
} satisfies Record<string, Partial<Record<DealStatus, DealMachineTransitionValue>>>;

export type DealCommand = keyof typeof DEAL_TRANSITIONS;

const intendedStatuses: Record<DealCommand, DealStatus> = {
  acceptCounterOffer: DealStatus.AGREED,
  acceptDeal: DealStatus.ACCEPTED,
  arrive: DealStatus.ARRIVED,
  autoAccept: DealStatus.ACCEPTED,
  cancelDeal: DealStatus.CANCELLED,
  chooseDelivery: DealStatus.LOGISTICS_CHOSEN,
  close: DealStatus.CLOSED,
  confirmDeal: DealStatus.AGREED,
  confirmDocuments: DealStatus.DOCUMENTS_CONFIRMED,
  counterDeal: DealStatus.COUNTER_OFFERED,
  fund: DealStatus.PAID,
  markDealShipped: DealStatus.SHIPPED,
  openClaim: DealStatus.CLAIM,
  publishTransportRequest: DealStatus.AWAITING_LOGISTICS,
  rejectCounterOffer: DealStatus.REJECTED,
  rejectDeal: DealStatus.REJECTED,
  requestPayment: DealStatus.AWAITING_PAYMENT,
  resolveClaim: DealStatus.ACCEPTED,
  settle: DealStatus.SETTLEMENT,
  startAccepting: DealStatus.ACCEPTING,
  startPicking: DealStatus.PICKING,
  startTransit: DealStatus.IN_TRANSIT,
  submitDeal: DealStatus.SUBMITTED,
  updateDealDraft: DealStatus.DRAFT,
};

export const dealMachine = createStateMachine<DealCommand, DealStatus, DealMachineTransitionValue>({
  entity: EntityKind.DEAL,
  intendedStatuses,
  statusName: status => DealStatus[status],
  transitions: DEAL_TRANSITIONS,
});
