import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

import type { DealEditorValue } from './dealInspectorTypes';

export type DealActionValue = 'accept' | 'submit' | DealEditorValue;
type PartyValue = 'customer' | 'supplier';

const CANCELLABLE_STATUSES: ReadonlySet<DealStatus> = new Set([
  DealStatus.AGREED,
  DealStatus.AWAITING_LOGISTICS,
  DealStatus.AWAITING_PAYMENT,
  DealStatus.COUNTER_OFFERED,
  DealStatus.DOCUMENTS_CONFIRMED,
  DealStatus.DRAFT,
  DealStatus.LOGISTICS_CHOSEN,
  DealStatus.SUBMITTED,
]);

const PARTY_ACTIONS: Record<PartyValue, Partial<Record<DealStatus, readonly DealActionValue[]>>> = {
  customer: {
    [DealStatus.AGREED]: ['delivery'],
    [DealStatus.AWAITING_LOGISTICS]: ['delivery'],
    [DealStatus.COUNTER_OFFERED]: ['accept', 'rejectOffer'],
    [DealStatus.DRAFT]: ['submit', 'draft'],
  },
  supplier: {
    [DealStatus.SUBMITTED]: ['confirm', 'counter', 'reject'],
  },
};

export const getDealActions = (status: DealStatus, party: PartyValue | undefined): readonly DealActionValue[] => {
  if (party === undefined || (party === 'supplier' && status === DealStatus.DRAFT)) {
    return [];
  }

  const actions = PARTY_ACTIONS[party][status] ?? [];

  return CANCELLABLE_STATUSES.has(status) ? [...actions, 'cancel'] : actions;
};
