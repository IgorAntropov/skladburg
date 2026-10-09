import type { ReactElement } from 'react';

import { User } from 'lucide-react';

import type { ProfileSummaryStateValue } from '@/entities/session';

import { useI18n } from '@/shared/i18n';
import {
  Avatar,
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

interface ProfileButtonIconProps {
  state: ProfileSummaryStateValue;
}

export const ProfileButtonIcon = ({ state }: ProfileButtonIconProps): ReactElement => {
  const { t } = useI18n();
  const isPending = state.kind === 'pending';
  const isSkeletonFilled = useDelayedVisibility(isPending);

  if (state.kind === 'ready') {
    return <Avatar name={state.summary.userDisplayName} seed={state.summary.userId} size="md" />;
  }

  if (state.kind === 'error') {
    return <User aria-hidden className="size-5" />;
  }

  return (
    <SkeletonGroup isFilled={isSkeletonFilled} label={t('profile.button.loading')}>
      <Skeleton className="size-9" shape="circle" />
    </SkeletonGroup>
  );
};
