import type { ReactElement } from 'react';

import type { IconButtonProps } from '@/shared/ui';

import { AssistantPortrait } from '@/entities/assistant';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { IconButton } from '@/shared/ui';

import { formatUnreadBadge } from '../lib/formatUnreadBadge';

export interface NotificationButtonProps extends Omit<IconButtonProps, 'icon' | 'label'> {
  unreadCount: number;
}

const BADGE_CLASS_NAME = [
  'pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full',
  'bg-on-panel px-1 text-xs leading-4 font-bold text-panel-solid tabular-nums ring-2 ring-panel-solid',
].join(' ');

export const NotificationButton = ({ className, unreadCount, ...rest }: NotificationButtonProps): ReactElement => {
  const { t } = useI18n();

  const isBadgeShown = unreadCount > 0;
  const label = isBadgeShown ? t('hud.notifications.button.unread', { count: unreadCount }) : t('hud.notifications.button');

  return (
    <div className="relative flex">
      <IconButton
        className={cn('rounded-full', className)}
        data-testid="notification-center-button"
        icon={<AssistantPortrait size="sm" />}
        label={label}
        variant="ghost"
        {...rest}
      />
      {isBadgeShown && (
        <span aria-hidden className={BADGE_CLASS_NAME} data-testid="notification-center-badge">
          {formatUnreadBadge(unreadCount)}
        </span>
      )}
    </div>
  );
};
