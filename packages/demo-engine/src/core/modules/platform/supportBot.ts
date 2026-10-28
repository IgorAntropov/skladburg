import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  NotificationImportance,
  NotificationKind,
  SupportReplyParamsSchema,
} from '@skladburg/contracts/notification/v1/notification';
import { userChannel } from '@skladburg/contracts/runtime';
import { SupportTicketChangedSchema } from '@skladburg/contracts/support/v1/support_events';
import {
  SupportMessageAuthorKind,
  SupportTicketMessageSchema,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@skladburg/contracts/support/v1/support_ticket';

import type { SchedulerTaskValue } from '../../scheduler/scheduler';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { findSupportResponderName } from './supportTicketRecords';
import {
  pickSupportReplyTemplate,
  SUPPORT_BOT_INTERVAL_MS,
} from './supportTicketRules';

export const SUPPORT_BOT_TASK_ID = 'support-bot';

export const createSupportBotTask = (runtime: IModuleRuntime): SchedulerTaskValue => {
  const { notifier, outbox, random } = runtime;

  const answerTicket = (transaction: IStateTransaction, ticketId: string): void => {
    const ticket = transaction.get('supportTickets', ticketId);

    if (ticket?.status !== SupportTicketStatus.OPEN) {
      return;
    }

    transaction.put('supportTicketMessages', create(SupportTicketMessageSchema, {
      authorDisplayName: findSupportResponderName(transaction),
      authorKind: SupportMessageAuthorKind.SUPPORT,
      body: { case: 'reply', value: pickSupportReplyTemplate(ticket) },
      createdAt: timestampFromMs(transaction.worldTimeMs),
      id: random.uuid(),
      ticketId: ticket.id,
    }));
    ticket.status = SupportTicketStatus.ANSWERED;
    transaction.put('supportTickets', ticket);
    outbox.add(transaction, userChannel(ticket.authorUserId), {
      case: 'supportTicketChanged',
      value: create(SupportTicketChangedSchema, { ticketId: ticket.id }),
    });
    notifier.post(transaction, {
      importance: ticket.priority === SupportTicketPriority.URGENT ? NotificationImportance.IMPORTANT : NotificationImportance.NORMAL,
      kind: NotificationKind.SUPPORT_REPLY,
      links: [],
      organizationId: ticket.organizationId,
      params: {
        case: 'supportReply',
        value: create(SupportReplyParamsSchema, { ticketId: ticket.id, ticketNumber: ticket.number }),
      },
      recipients: [ticket.authorUserId],
    });
  };

  return {
    id: SUPPORT_BOT_TASK_ID,
    intervalMs: SUPPORT_BOT_INTERVAL_MS,
    run: (transaction) => {
      const dueRecords = transaction.list('supportBotQueue')
        .filter(record => record.dueAtMs <= transaction.worldTimeMs)
        .sort((current, next) => current.dueAtMs - next.dueAtMs);

      for (const record of dueRecords) {
        answerTicket(transaction, record.id);
        transaction.delete('supportBotQueue', record.id);
      }
    },
  };
};
