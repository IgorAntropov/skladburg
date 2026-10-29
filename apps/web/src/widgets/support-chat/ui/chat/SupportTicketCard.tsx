import type { SupportTicket } from '@skladburg/contracts/support/v1/support_ticket';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  SupportTicketPriority,
  SupportTicketStatus,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  ChevronDown,
  CircleCheck,
  Clock,
  MessageSquareReply,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  useAnnounce,
} from '@/shared/ui';

import type { SupportTranslate } from '../../lib/supportTranslate';

import { getSupportCategoryDescriptor } from '../../lib/supportCategories';
import {
  formatSupportTicketStatus,
  isSupportReplyArrived,
} from '../../lib/supportTicketStatus';
import { SupportTicketBody } from './SupportTicketBody';
import { SupportUrgentBadge } from './SupportUrgentBadge';

interface SupportTicketCardProps {
  isExpanded: boolean;
  isFocusRequested: boolean;
  onToggle: (ticketId: string) => void;
  t: SupportTranslate;
  ticket: SupportTicket;
}

const STATUS_ICONS = {
  [SupportTicketStatus.ANSWERED]: MessageSquareReply,
  [SupportTicketStatus.CLOSED]: CircleCheck,
  [SupportTicketStatus.OPEN]: Clock,
  [SupportTicketStatus.UNSPECIFIED]: Clock,
} as const satisfies Record<SupportTicketStatus, LucideIcon>;

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit' } as const;

const TRIGGER_CLASS_NAME = [
  'w-full flex-col items-stretch justify-start gap-1 border-transparent p-3 text-left font-normal',
  'aria-expanded:bg-transparent focus-visible:-outline-offset-2',
].join(' ');

export const SupportTicketCard = ({
  isExpanded,
  isFocusRequested,
  onToggle,
  t,
  ticket,
}: SupportTicketCardProps): ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();
  const announce = useAnnounce();
  const bodyId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const prevStatusRef = useRef(ticket.status);

  const formatTime = (instantMs: number): string => formatDateTime(instantMs, { format: TIME_FORMAT, timeZone: userTimeZone });

  const ticketNumber = String(ticket.number);
  const isUrgent = ticket.priority === SupportTicketPriority.URGENT;
  const StatusIcon = STATUS_ICONS[ticket.status];
  const categoryName = getSupportCategoryDescriptor(ticket.category)?.nameKey;
  const createdAtText = ticket.createdAt === undefined ? '' : formatTime(timestampMs(ticket.createdAt));
  const dueAtText = ticket.responseDueAt === undefined ? '' : formatTime(timestampMs(ticket.responseDueAt));
  const metaText = categoryName === undefined
    ? createdAtText
    : t('support.ticket.meta', { category: t(categoryName), time: createdAtText });

  const handleToggleClick = (): void => {
    console.log('> SupportTicketCard -> handleToggleClick:', { isExpanded, ticketId: ticket.id });
    onToggle(ticket.id);
  };

  useEffect(() => {
    if (isSupportReplyArrived(ticket.status, prevStatusRef.current)) {
      announce(t('support.announce.reply', { ticketNumber }));
    }
    prevStatusRef.current = ticket.status;
  }, [announce, t, ticket.status, ticketNumber]);

  useEffect(() => {
    if (isFocusRequested) {
      triggerRef.current?.focus();
    }
  }, [isFocusRequested]);

  return (
    <li className="rounded-control border border-line" data-testid={`support-ticket-${ticketNumber}`}>
      <h3>
        <Button
          aria-controls={isExpanded ? bodyId : undefined}
          aria-expanded={isExpanded}
          className={TRIGGER_CLASS_NAME}
          onClick={handleToggleClick}
          ref={triggerRef}
          variant="neutral"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold">
              {t('support.ticket.title', { ticketNumber })}
              {isUrgent && <SupportUrgentBadge t={t} />}
            </span>
            <ChevronDown
              aria-hidden
              className={cn('size-5 shrink-0 text-on-panel-muted motion-safe:transition-transform', isExpanded && 'rotate-180')}
            />
          </span>
          <span className="text-sm text-on-panel-muted">{metaText}</span>
          <span className="flex items-center gap-2 text-sm text-on-panel-muted">
            <StatusIcon aria-hidden className="size-4 shrink-0" />
            {formatSupportTicketStatus(t, ticket.status, dueAtText)}
          </span>
        </Button>
      </h3>
      {isExpanded && <SupportTicketBody id={bodyId} t={t} ticket={ticket} />}
    </li>
  );
};
