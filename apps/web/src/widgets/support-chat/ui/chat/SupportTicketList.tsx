import type { ReactElement } from 'react';

import { LifeBuoy } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { AssistantPortrait } from '@/entities/assistant';
import { useMySupportTicketsQuery } from '@/entities/support-ticket';
import {
  Button,
  EmptyState,
  WidgetStates,
} from '@/shared/ui';

import type { SupportTranslate } from '../../lib/supportTranslate';
import type { SupportFocusRequestValue } from './supportFocusRequest';

import { SupportListSkeleton } from './SupportListSkeleton';
import { SupportTicketCard } from './SupportTicketCard';

interface SupportTicketListProps {
  focusRequest: SupportFocusRequestValue | undefined;
  onCall: () => void;
  t: SupportTranslate;
}

const NO_TICKET_ID = '';

interface PickedTicketValue {
  focusRequest: SupportFocusRequestValue | undefined;
  ticketId: string;
}

const SECONDARY_CALL_BUTTON_CLASS_NAME = 'self-start';

export const SupportTicketList = ({ focusRequest, onCall, t }: SupportTicketListProps): ReactElement => {
  const { data, error, isFetching, refetch } = useMySupportTicketsQuery();
  const callButtonRef = useRef<HTMLButtonElement>(null);
  const [pick, setPick] = useState<PickedTicketValue | undefined>(undefined);

  const latestTicketId = data?.tickets[0]?.id;
  const isPickCurrent = pick !== undefined && pick.focusRequest === focusRequest;
  const pickedTicketId = isPickCurrent ? pick.ticketId : undefined;
  const expandedTicketId = pickedTicketId ?? latestTicketId;
  const isListEmpty = data?.tickets.length === 0;
  const focusedTicketId = focusRequest?.kind === 'ticket' ? focusRequest.ticketId : undefined;

  const handleCallClick = (): void => {
    console.log('> SupportTicketList -> handleCallClick:', { isListEmpty });
    onCall();
  };

  const handleToggle = (ticketId: string): void => {
    console.log('> SupportTicketList -> handleToggle:', { expandedTicketId, ticketId });
    setPick({ focusRequest, ticketId: ticketId === expandedTicketId ? NO_TICKET_ID : ticketId });
  };

  const handleRetry = (): void => {
    console.log('> SupportTicketList -> handleRetry:', { hasError: error !== null });
    void refetch();
  };

  const renderCallButton = (variant: 'primary' | 'secondary'): ReactElement => {
    const callButtonClassName = variant === 'secondary' ? SECONDARY_CALL_BUTTON_CLASS_NAME : undefined;

    return (
      <Button
        className={callButtonClassName}
        data-testid="support-call-button"
        onClick={handleCallClick}
        ref={callButtonRef}
        variant={variant}
      >
        <LifeBuoy aria-hidden className="size-5" />
        {t('support.action.call')}
      </Button>
    );
  };

  useEffect(() => {
    if (focusRequest?.kind === 'call') {
      callButtonRef.current?.focus();
    }
  }, [focusRequest]);

  const secondaryCallButton = isListEmpty ? undefined : renderCallButton('secondary');

  return (
    <div className="flex flex-col gap-4">
      {secondaryCallButton}
      <WidgetStates
        data={data}
        empty={(
          <EmptyState
            action={renderCallButton('primary')}
            hint={t('support.list.empty.hint')}
            media={<AssistantPortrait size="sm" />}
            text={t('support.list.empty.text')}
          />
        )}
        error={error}
        isEmpty={response => response.tickets.length === 0}
        isRetrying={isFetching}
        loadingLabel={t('support.list.loading')}
        onRetry={handleRetry}
        skeleton={<SupportListSkeleton />}
      >
        {response => (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-on-panel-muted">{t('support.list.title')}</h2>
            <ul className="flex flex-col gap-3">
              {response.tickets.map(ticket => (
                <SupportTicketCard
                  isExpanded={ticket.id === expandedTicketId}
                  isFocusRequested={ticket.id === focusedTicketId}
                  key={ticket.id}
                  onToggle={handleToggle}
                  t={t}
                  ticket={ticket}
                />
              ))}
            </ul>
          </section>
        )}
      </WidgetStates>
    </div>
  );
};
