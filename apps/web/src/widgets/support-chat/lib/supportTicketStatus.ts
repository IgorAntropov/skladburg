import { SupportTicketStatus } from '@skladburg/contracts/support/v1/support_ticket';

import type { SupportCatalogValue } from '../i18n/supportSection';
import type { SupportTranslate } from './supportTranslate';

type KnownSupportTicketStatusValue = Exclude<SupportTicketStatus, SupportTicketStatus.UNSPECIFIED>;

export const SUPPORT_STATUS_KEYS = {
  [SupportTicketStatus.ANSWERED]: 'support.ticket.status.answered',
  [SupportTicketStatus.CLOSED]: 'support.ticket.status.closed',
  [SupportTicketStatus.OPEN]: 'support.ticket.status.open',
} as const satisfies Record<KnownSupportTicketStatusValue, keyof SupportCatalogValue>;

export const formatSupportTicketStatus = (t: SupportTranslate, status: SupportTicketStatus, dueAtText: string): string => {
  switch (status) {
    case SupportTicketStatus.ANSWERED:
    case SupportTicketStatus.CLOSED:
      return t(SUPPORT_STATUS_KEYS[status]);
    case SupportTicketStatus.OPEN:
      return t(SUPPORT_STATUS_KEYS[status], { dueAt: dueAtText });
    case SupportTicketStatus.UNSPECIFIED:
      return '';
    default: {
      const unhandledStatus: never = status;

      return unhandledStatus;
    }
  }
};

export const isSupportReplyArrived = (current: SupportTicketStatus, prev: SupportTicketStatus): boolean => (
  prev === SupportTicketStatus.OPEN && current === SupportTicketStatus.ANSWERED
);
