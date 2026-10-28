import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type {
  SupportTicket,
  SupportTicketMessage,
} from '@skladburg/contracts/support/v1/support_ticket';

import { timestampMs } from '@bufbuild/protobuf/wkt';

import type { IStateReader } from '../../state/index';

import {
  resolvePermissionGrants,
  summarizePermissionGrants,
} from '../../access/index';
import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../../platform/index';
import { compareIds } from '../../state/index';
import { FIRST_SUPPORT_TICKET_NUMBER } from './supportTicketRules';

const SUPPORT_REPLY_PERMISSION = 'support_ticket_edit';

const readTimestampMs = (timestamp: Timestamp | undefined): number =>
  timestamp === undefined ? 0 : timestampMs(timestamp);

const compareTicketsNewestFirst = (current: SupportTicket, next: SupportTicket): number =>
  readTimestampMs(next.createdAt) - readTimestampMs(current.createdAt) || compareIds(current.id, next.id);

const compareMessagesOldestFirst = (current: SupportTicketMessage, next: SupportTicketMessage): number =>
  readTimestampMs(current.createdAt) - readTimestampMs(next.createdAt) || compareIds(current.id, next.id);

export const computeNextSupportTicketNumber = (reader: IStateReader): number =>
  reader.list('supportTickets').reduce(
    (largest, ticket) => Math.max(largest, ticket.number),
    FIRST_SUPPORT_TICKET_NUMBER - 1,
  ) + 1;

export const listAuthorTickets = (reader: IStateReader, userId: string, organizationId: string): SupportTicket[] =>
  reader.listBy('supportTickets', 'authorUserId', userId)
    .filter(ticket => ticket.organizationId === organizationId)
    .sort(compareTicketsNewestFirst);

export const listTicketMessages = (reader: IStateReader, ticketId: string): SupportTicketMessage[] =>
  reader.listBy('supportTicketMessages', 'ticketId', ticketId).sort(compareMessagesOldestFirst);

export const findSupportResponderName = (reader: IStateReader): string => {
  const responderIds = reader.listBy('memberships', 'organizationId', PLATFORM_OPERATOR_ORGANIZATION_ID)
    .filter(membership => summarizePermissionGrants(resolvePermissionGrants(reader, membership))
      .some(effective => effective.permission === SUPPORT_REPLY_PERMISSION))
    .map(membership => membership.userId)
    .sort(compareIds);
  const [responderId] = responderIds;

  return responderId === undefined ? '' : (reader.get('users', responderId)?.displayName ?? '');
};
