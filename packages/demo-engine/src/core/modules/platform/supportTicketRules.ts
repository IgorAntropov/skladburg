import { create } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  type SupportErrorRef,
  type SupportReply,
  SupportReplySchema,
  SupportReplyTemplate,
  type SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
} from '@skladburg/contracts/support/v1/support_ticket';

export const FIRST_SUPPORT_TICKET_NUMBER = 1001;
export const SUPPORT_BOT_REPLY_DELAY_MS = 4_000;
export const SUPPORT_BOT_INTERVAL_MS = 1_000;
export const SUPPORT_URGENT_RESPONSE_WINDOW_MS = 3_600_000;
export const SUPPORT_NORMAL_RESPONSE_WINDOW_MS = 28_800_000;

const URGENT_CATEGORIES: ReadonlySet<SupportTicketCategory> = new Set([
  SupportTicketCategory.MONEY,
  SupportTicketCategory.RECEIVING_BLOCKED,
]);

const readOccurredAtMs = (error: SupportErrorRef): number =>
  error.occurredAt === undefined ? 0 : timestampMs(error.occurredAt);

const pickLatestError = (errors: readonly SupportErrorRef[]): SupportErrorRef | undefined =>
  errors.reduce<SupportErrorRef | undefined>(
    (latest, candidate) => latest !== undefined && readOccurredAtMs(candidate) <= readOccurredAtMs(latest) ? latest : candidate,
    undefined,
  );

export const resolveSupportTicketPriority = (category: SupportTicketCategory): SupportTicketPriority =>
  URGENT_CATEGORIES.has(category) ? SupportTicketPriority.URGENT : SupportTicketPriority.NORMAL;

export const resolveSupportResponseWindowMs = (priority: SupportTicketPriority): number =>
  priority === SupportTicketPriority.URGENT ? SUPPORT_URGENT_RESPONSE_WINDOW_MS : SUPPORT_NORMAL_RESPONSE_WINDOW_MS;

export const pickSupportReplyTemplate = (ticket: SupportTicket): SupportReply => {
  const latestError = pickLatestError(ticket.context?.errors ?? []);

  if (latestError !== undefined) {
    return create(SupportReplySchema, {
      errorCode: latestError.code,
      template: SupportReplyTemplate.ERROR_EXPLAINED,
      traceId: latestError.traceId,
    });
  }

  return create(SupportReplySchema, {
    template: ticket.priority === SupportTicketPriority.URGENT
      ? SupportReplyTemplate.URGENT_ACKNOWLEDGED
      : SupportReplyTemplate.ACKNOWLEDGED,
  });
};
