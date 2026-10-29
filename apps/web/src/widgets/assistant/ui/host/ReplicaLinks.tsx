import type { ReactElement } from 'react';

import { useMarkNotificationsRead } from '@/entities/notification';
import {
  Button,
  TextLink,
} from '@/shared/ui';

import type { AssistantTranslate } from '../../lib/formatReplicaText';
import type {
  ReplicaCenterActionValue,
  ReplicaCenterTabValue,
  ReplicaValue,
} from '../../model/replicaTypes';

export interface ReplicaLinksProps {
  notificationIds: readonly string[];
  onNavigate: () => void;
  onOpenCenter: (tab: ReplicaCenterTabValue) => void;
  replica: ReplicaValue;
  t: AssistantTranslate;
}

const LINK_LABEL_KEYS = {
  map: 'assistant.link.map',
  open: 'assistant.link.open',
  organization: 'assistant.link.organization',
} as const;

const CENTER_ACTIONS = {
  callSupport: { labelKey: 'assistant.link.callSupport', tab: 'help', testId: 'assistant-replica-link-call-support' },
  notifications: { labelKey: 'assistant.link.center', tab: 'notifications', testId: 'assistant-replica-link-center' },
  openChat: { labelKey: 'assistant.link.openChat', tab: 'help', testId: 'assistant-replica-link-open-chat' },
} as const satisfies Record<ReplicaCenterActionValue, { labelKey: string; tab: ReplicaCenterTabValue; testId: string }>;

const CENTER_BUTTON_CLASS_NAME = '-mx-1 px-1! text-sm font-medium text-link underline underline-offset-2';

export const ReplicaLinks = ({ notificationIds, onNavigate, onOpenCenter, replica, t }: ReplicaLinksProps): ReactElement => {
  const markRead = useMarkNotificationsRead(notificationIds);

  const handleLinkClick = (): void => {
    console.log('> ReplicaLinks -> handleLinkClick:', { replicaId: replica.id });

    if (notificationIds.length > 0) {
      markRead.run();
    }

    onNavigate();
  };

  const centerAction = replica.centerAction === undefined ? undefined : CENTER_ACTIONS[replica.centerAction];

  const handleCenterClick = (): void => {
    console.log('> ReplicaLinks -> handleCenterClick:', { replicaId: replica.id, tab: centerAction?.tab });

    if (centerAction === undefined) {
      return;
    }

    if (notificationIds.length > 0) {
      markRead.run();
    }

    onOpenCenter(centerAction.tab);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4">
      {replica.links.map(link => (
        <TextLink
          data-testid={`assistant-replica-link-${link.kind}`}
          isFocusRequested={link.isFocusRequested}
          key={link.id}
          onClick={handleLinkClick}
          size="sm"
          to={link.address}
        >
          {t(LINK_LABEL_KEYS[link.kind])}
        </TextLink>
      ))}
      {centerAction !== undefined && (
        <Button
          className={CENTER_BUTTON_CLASS_NAME}
          data-testid={centerAction.testId}
          onClick={handleCenterClick}
          variant="ghost"
        >
          {t(centerAction.labelKey)}
        </Button>
      )}
    </div>
  );
};
