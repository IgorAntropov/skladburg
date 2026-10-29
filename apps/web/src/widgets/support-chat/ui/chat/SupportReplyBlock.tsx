import type { SupportTicketMessage } from '@skladburg/contracts/support/v1/support_ticket';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { LifeBuoy } from 'lucide-react';

import { useI18n } from '@/shared/i18n';

import type { SupportTranslate } from '../../lib/supportTranslate';

import { formatSupportMessage } from '../../lib/supportReply';

interface SupportReplyBlockProps {
  message: SupportTicketMessage;
  t: SupportTranslate;
}

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit' } as const;

export const SupportReplyBlock = ({ message, t }: SupportReplyBlockProps): ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();

  const text = formatSupportMessage(t, message);
  const timeText = message.createdAt === undefined
    ? ''
    : formatDateTime(timestampMs(message.createdAt), { format: TIME_FORMAT, timeZone: userTimeZone });

  return (
    <div className="flex flex-col gap-2 rounded-control bg-hover p-3 motion-safe:animate-menu-in" data-testid="support-reply">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control bg-skeleton text-on-panel">
          <LifeBuoy className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-on-panel">
            {t('support.reply.author', { staffName: message.authorDisplayName })}
          </span>
          <span className="text-sm text-on-panel-muted">{timeText}</span>
        </div>
      </div>
      <p className="text-base text-pretty text-on-panel">{text}</p>
    </div>
  );
};
