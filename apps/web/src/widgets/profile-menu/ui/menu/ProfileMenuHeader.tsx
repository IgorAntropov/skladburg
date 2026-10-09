import type { ReactElement } from 'react';

import { useProfileSummary } from '@/entities/session';
import { useCurrentPersona } from '@/features/switch-persona';
import { useI18n } from '@/shared/i18n';
import {
  Avatar,
  Skeleton,
} from '@/shared/ui';

import { SideBadges } from './SideBadges';

const HEADER_CLASS_NAME = 'flex flex-col items-center gap-1 px-3 pt-4 pb-3 text-center';

export const ProfileMenuHeader = (): ReactElement => {
  const { t } = useI18n();
  const summaryState = useProfileSummary();
  const { isPending: isPersonaPending, persona } = useCurrentPersona();

  if (summaryState.kind === 'pending') {
    return (
      <div aria-hidden className={HEADER_CLASS_NAME}>
        <Skeleton className="size-16" shape="circle" />
        <Skeleton className="mt-2 h-5 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>
    );
  }

  if (summaryState.kind === 'error') {
    return (
      <div className={HEADER_CLASS_NAME}>
        <Avatar name="" seed="" size="lg" />
      </div>
    );
  }

  const { organizationName, sides, userDisplayName, userId } = summaryState.summary;
  const roleName = persona?.roleName ?? '';
  const hasRole = roleName !== '';
  const secondLine = hasRole ? t('profile.role', { organization: organizationName, role: roleName }) : organizationName;

  return (
    <div className={HEADER_CLASS_NAME} data-testid="profile-menu-header">
      <Avatar name={userDisplayName} seed={userId} size="lg" />
      <p className="mt-2 max-w-full text-lg leading-6 font-semibold break-words" data-testid="profile-menu-name">{userDisplayName}</p>
      {isPersonaPending
        ? <Skeleton className="h-4 w-52" />
        : <p className="max-w-full text-sm leading-5 break-words text-on-panel-muted" data-testid="profile-menu-role">{secondLine}</p>}
      <SideBadges sides={sides} />
    </div>
  );
};
