import type { SupportTicket } from '@skladburg/contracts/support/v1/support_ticket';
import type { ReactElement } from 'react';

import {
  SupportMessageAuthorKind,
  SupportTicketStatus,
} from '@skladburg/contracts/support/v1/support_ticket';
import { Clock } from 'lucide-react';

import { useSupportTicketQuery } from '@/entities/support-ticket';
import {
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { SupportTranslate } from '../../lib/supportTranslate';

import { SupportContextRows } from './SupportContextRows';
import { SupportReplyBlock } from './SupportReplyBlock';

interface SupportTicketBodyProps {
  id: string;
  t: SupportTranslate;
  ticket: SupportTicket;
}

const REPLY_SKELETON = (
  <div className="flex flex-col gap-2 rounded-control bg-hover p-3">
    <Skeleton className="h-5 w-[50%]" />
    <Skeleton className="h-4 w-[90%]" />
  </div>
);

export const SupportTicketBody = ({ id, t, ticket }: SupportTicketBodyProps): ReactElement => {
  const isWaiting = ticket.status === SupportTicketStatus.OPEN;

  const { data, error, isFetching, refetch } = useSupportTicketQuery(isWaiting ? undefined : ticket.id);

  const handleRetry = (): void => {
    console.log('> SupportTicketBody -> handleRetry:', { ticketId: ticket.id });
    void refetch();
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line p-3" id={id}>
      {isWaiting
        ? (
            <div className="flex flex-col gap-1 rounded-control bg-hover p-3" data-testid="support-waiting">
              <p className="flex items-center gap-2 text-base font-medium">
                <Clock aria-hidden className="size-4 shrink-0" />
                {t('support.ticket.waiting.title')}
              </p>
              <p className="text-sm text-pretty text-on-panel-muted">{t('support.ticket.waiting.hint')}</p>
            </div>
          )
        : (
            <WidgetStates
              data={data}
              error={error}
              isRetrying={isFetching}
              loadingLabel={t('support.list.loading')}
              onRetry={handleRetry}
              skeleton={REPLY_SKELETON}
            >
              {response => response.messages
                .filter(message => message.authorKind === SupportMessageAuthorKind.SUPPORT)
                .map(message => <SupportReplyBlock key={message.id} message={message} t={t} />)}
            </WidgetStates>
          )}
      {ticket.context !== undefined && (
        <>
          <p className="text-sm font-semibold">{t('support.ticket.contextTitle')}</p>
          <SupportContextRows context={ticket.context} t={t} />
        </>
      )}
    </div>
  );
};
