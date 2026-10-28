import type { ReactElement } from 'react';

import { useMarkNotificationsRead } from '@/entities/notification';
import {
  Button,
  TextLink,
} from '@/shared/ui';

import type { AssistantTranslate } from '../../lib/formatReplicaText';
import type { ReplicaValue } from '../../model/replicaTypes';

export interface ReplicaLinksProps {
  notificationIds: readonly string[];
  onNavigate: () => void;
  onOpenCenter: () => void;
  replica: ReplicaValue;
  t: AssistantTranslate;
}

const LINK_LABEL_KEYS = {
  map: 'assistant.link.map',
  open: 'assistant.link.open',
  organization: 'assistant.link.organization',
} as const;

const CENTER_BUTTON_CLASS_NAME = '-mx-1 px-1! text-sm underline underline-offset-2';

export const ReplicaLinks = ({ notificationIds, onNavigate, onOpenCenter, replica, t }: ReplicaLinksProps): ReactElement => {
  const markRead = useMarkNotificationsRead(notificationIds);

  const handleLinkClick = (): void => {
    console.log('> ReplicaLinks -> handleLinkClick:', { replicaId: replica.id });

    if (notificationIds.length > 0) {
      markRead.run();
    }

    onNavigate();
  };

  const handleCenterClick = (): void => {
    console.log('> ReplicaLinks -> handleCenterClick:', { replicaId: replica.id });
    onOpenCenter();
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
      {replica.hasCenterLink && (
        <Button
          className={CENTER_BUTTON_CLASS_NAME}
          data-testid="assistant-replica-link-center"
          onClick={handleCenterClick}
          variant="ghost"
        >
          {t('assistant.link.center')}
        </Button>
      )}
    </div>
  );
};
