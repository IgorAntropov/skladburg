import type { SupportTicket } from '@skladburg/contracts/support/v1/support_ticket';
import type { ReactElement } from 'react';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useSupportContextCapture } from '@/features/call-support';
import { useAnnounce } from '@/shared/ui';

import type { SupportTranslate } from '../../lib/supportTranslate';
import type { SupportFocusRequestValue } from './supportFocusRequest';

import { claimHelpTabFocus } from '../../lib/claimHelpTabFocus';
import { useSupportForm } from '../../model/useSupportForm';
import { SupportCallForm } from './SupportCallForm';
import { SupportTicketList } from './SupportTicketList';

interface SupportChatContentProps {
  t: SupportTranslate;
}

export const SupportChatContent = ({ t }: SupportChatContentProps): ReactElement => {
  const announce = useAnnounce();
  const capture = useSupportContextCapture();
  const { close, consumeFocus, draft, open, selectCategory } = useSupportForm();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState<SupportFocusRequestValue | undefined>(undefined);

  const isFormOpen = draft !== undefined;

  const handleCall = (): void => {
    console.log('> SupportChatContent -> handleCall:', {});
    setFocusRequest(undefined);
    open(capture());
  };

  const handleCancel = (): void => {
    console.log('> SupportChatContent -> handleCancel:', {});
    close();
    setFocusRequest({ kind: 'call' });
  };

  const handleCreated = (ticket: SupportTicket): void => {
    console.log('> SupportChatContent -> handleCreated:', { ticketId: ticket.id });
    close();
    setFocusRequest({ kind: 'ticket', ticketId: ticket.id });
    announce(t('support.announce.sent', { ticketNumber: String(ticket.number) }));
  };

  useEffect(() => {
    const contentElement = rootRef.current;

    if (contentElement === null) {
      return undefined;
    }

    const frameId = requestAnimationFrame(() => {
      claimHelpTabFocus(contentElement);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div data-testid="support-chat" ref={rootRef}>
      <div hidden={isFormOpen}>
        <SupportTicketList focusRequest={focusRequest} onCall={handleCall} t={t} />
      </div>
      {draft !== undefined && (
        <SupportCallForm
          draft={draft}
          onCancel={handleCancel}
          onCategoryChange={selectCategory}
          onCreated={handleCreated}
          onFocusHandled={consumeFocus}
          t={t}
        />
      )}
    </div>
  );
};
