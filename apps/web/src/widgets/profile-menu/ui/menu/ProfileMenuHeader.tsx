import type { ReactElement } from 'react';

import { useProfileSummary } from '@/entities/session';
import { useI18n } from '@/shared/i18n';
import {
  Avatar,
  Skeleton,
} from '@/shared/ui';

import { SideBadges } from './SideBadges';
import { useProfileSecondLine } from './useProfileSecondLine';

const HEADER_CLASS_NAME = 'flex items-center gap-3 px-3 py-3 text-left';

const NAME_CLASS_NAME = 'max-w-full text-lg leading-6 font-semibold tracking-tight break-words';

const HEADER_TEXT_CLASS_NAME = 'flex min-w-0 flex-1 flex-col items-start gap-0.5';

export const ProfileMenuHeader = (): ReactElement => {
  const { t } = useI18n();
  const summaryState = useProfileSummary();
  const secondLine = useProfileSecondLine();

  if (summaryState.kind === 'pending') {
    return (
      <div aria-hidden className={HEADER_CLASS_NAME}>
        <Skeleton className="size-16" shape="circle" />
        <div className={HEADER_TEXT_CLASS_NAME}>
          <div className="flex h-6 items-center">
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-48" />
          </div>
          <Skeleton className="mt-1.5 h-6 w-28" shape="circle" />
        </div>
      </div>
    );
  }

  if (summaryState.kind === 'error') {
    return (
      <div className={HEADER_CLASS_NAME}>
        <Avatar name="" seed="" size="lg" />
        <p className="min-w-0 flex-1 text-base leading-6 font-medium">{t('profile.header.error')}</p>
      </div>
    );
  }

  const { sides, userAvatarUrl, userDisplayName, userId } = summaryState.summary;

  return (
    <div className={HEADER_CLASS_NAME} data-testid="profile-menu-header">
      <Avatar imageUrl={userAvatarUrl} name={userDisplayName} seed={userId} size="lg" />
      <div className={HEADER_TEXT_CLASS_NAME}>
        <p className={NAME_CLASS_NAME}>{userDisplayName}</p>
        {secondLine.isPending
          ? (
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-48" />
              </div>
            )
          : <p className="max-w-full text-sm leading-5 break-words text-on-panel-muted">{secondLine.text}</p>}
        <SideBadges sides={sides} />
      </div>
    </div>
  );
};
