import type { ServiceImpl } from '@connectrpc/connect';
import type { Membership } from '@skladburg/contracts/access/v1/access';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { userChannel } from '@skladburg/contracts/runtime';
import { SupportTicketChangedSchema } from '@skladburg/contracts/support/v1/support_events';
import {
  CreateSupportTicketResponseSchema,
  GetSupportTicketResponseSchema,
  ListMySupportTicketsResponseSchema,
  SupportTicketChannel,
  SupportTicketSchema,
  SupportTicketService,
  SupportTicketStatus,
} from '@skladburg/contracts/support/v1/support_ticket';

import type { CallerValue } from '../../access/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { readActingContext } from '../../context/index';
import { compareIds } from '../../state/index';
import { paginate } from '../pagination';
import {
  computeNextSupportTicketNumber,
  listAuthorTickets,
  listTicketMessages,
} from './supportTicketRecords';
import {
  resolveSupportResponseWindowMs,
  resolveSupportTicketPriority,
  SUPPORT_BOT_REPLY_DELAY_MS,
} from './supportTicketRules';

export const createSupportTicketService = (runtime: IModuleRuntime): ServiceImpl<typeof SupportTicketService> => {
  const { command, errors, guard, idempotency, outbox, read } = runtime;

  const requireMembership = (reader: IModuleRuntime['read'], caller: CallerValue, headers: Headers): Membership => {
    const { organizationId } = readActingContext(headers);
    const membership = organizationId === undefined
      ? undefined
      : reader.listBy('memberships', 'userId', caller.user.id).find(candidate => candidate.organizationId === organizationId);

    if (membership === undefined) {
      throw errors.membershipRequired();
    }

    return membership;
  };

  const listRoleIds = (membership: Membership): string[] =>
    [...new Set(membership.roleAssignments.map(assignment => assignment.roleId))].sort(compareIds);

  return {
    createSupportTicket: (request, context) => command((transaction) => {
      const caller = guard.guardCall(transaction, SupportTicketService.method.createSupportTicket, request, context.requestHeader);
      const membership = requireMembership(transaction, caller, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const priority = resolveSupportTicketPriority(request.category);
          const ticket = create(SupportTicketSchema, {
            authorRoleIds: listRoleIds(membership),
            authorUserId: caller.user.id,
            category: request.category,
            channel: SupportTicketChannel.ASSISTANT,
            context: request.context,
            createdAt: timestampFromMs(transaction.worldTimeMs),
            id: runtime.random.uuid(),
            number: computeNextSupportTicketNumber(transaction),
            organizationId: membership.organizationId,
            priority,
            responseDueAt: timestampFromMs(transaction.worldTimeMs + resolveSupportResponseWindowMs(priority)),
            status: SupportTicketStatus.OPEN,
          });

          transaction.put('supportTickets', ticket);
          transaction.put('supportBotQueue', { dueAtMs: transaction.worldTimeMs + SUPPORT_BOT_REPLY_DELAY_MS, id: ticket.id });
          outbox.add(transaction, userChannel(ticket.authorUserId), {
            case: 'supportTicketChanged',
            value: create(SupportTicketChangedSchema, { ticketId: ticket.id }),
          });

          return create(CreateSupportTicketResponseSchema, { ticket });
        },
        idempotencyKey: request.idempotencyKey,
        method: SupportTicketService.method.createSupportTicket,
        request,
        scope: [caller.user.id, membership.organizationId].join(':'),
      });
    }),
    getSupportTicket: (request, context) => {
      const caller = guard.guardCall(read, SupportTicketService.method.getSupportTicket, request, context.requestHeader);
      const membership = requireMembership(read, caller, context.requestHeader);
      const ticket = read.get('supportTickets', request.ticketId);

      if (ticket?.authorUserId !== caller.user.id || ticket.organizationId !== membership.organizationId) {
        throw errors.notFound(EntityKind.SUPPORT_TICKET);
      }

      return create(GetSupportTicketResponseSchema, { messages: listTicketMessages(read, ticket.id), ticket });
    },
    listMySupportTickets: (request, context) => {
      const caller = guard.guardCall(read, SupportTicketService.method.listMySupportTickets, request, context.requestHeader);
      const membership = requireMembership(read, caller, context.requestHeader);
      const tickets = listAuthorTickets(read, caller.user.id, membership.organizationId);
      const { items, page } = paginate(tickets, ticket => ticket.id, request.page, errors);

      return create(ListMySupportTicketsResponseSchema, { page, tickets: items });
    },
  };
};
