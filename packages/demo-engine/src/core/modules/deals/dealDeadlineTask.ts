import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';

import type { SchedulerTransactionTaskValue } from '../../scheduler/scheduler';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { compareIds } from '../../state/index';
import { DEAL_DEADLINE_RULES } from './dealDeadlineRules';
import { postDealNotice } from './dealEffects';

const remindDeal = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  const isWaitingForSupplier = deal.status === DealStatus.SUBMITTED;
  const isWaitingForCustomer = deal.status === DealStatus.COUNTER_OFFERED;

  if (deal.submittedAt === undefined || (!isWaitingForSupplier && !isWaitingForCustomer)) {
    return;
  }

  const dueAt = isWaitingForSupplier ? deal.deadlines?.confirmationDueAt : deal.deadlines?.counterOfferDueAt;

  if (dueAt === undefined || timestampMs(dueAt) > transaction.worldTimeMs) {
    return;
  }

  const dueAtMs = timestampMs(dueAt);
  const mark = transaction.get('dealReminderMarks', deal.id) ?? {
    confirmationDueAtMs: undefined,
    counterOfferDueAtMs: undefined,
    id: deal.id,
  };
  const markKey = isWaitingForSupplier ? 'confirmationDueAtMs' : 'counterOfferDueAtMs';

  if (mark[markKey] === dueAtMs) {
    return;
  }

  const notice = isWaitingForSupplier ? DealNotice.CONFIRMATION_DUE : DealNotice.COUNTER_OFFER_DUE;
  const organizationId = isWaitingForSupplier ? deal.supplierOrganizationId : deal.customerOrganizationId;

  postDealNotice(runtime, transaction, deal, notice, organizationId);
  mark[markKey] = dueAtMs;
  transaction.put('dealReminderMarks', mark);
};

export const createDealDeadlineTask = (runtime: IModuleRuntime): SchedulerTransactionTaskValue => ({
  id: 'deal-deadline-reminders',
  intervalMs: DEAL_DEADLINE_RULES.pollIntervalMs,
  run: (transaction) => {
    const deals = transaction.list('deals').sort((current, prev) => compareIds(current.id, prev.id));

    for (const deal of deals) {
      remindDeal(runtime, transaction, deal);
    }
  },
});
