import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { Eye } from 'lucide-react';
import {
  useEffect,
  useRef,
} from 'react';

import {
  useCan,
  useProfileSummary,
} from '@/entities/session';
import { ChangeAvatarActions } from '@/features/change-avatar';
import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';
import { Avatar } from '@/shared/ui';

import { ProfileMyProfileSkeleton } from '../menu/ProfileMyProfileSkeleton';
import { SideBadges } from '../menu/SideBadges';
import { useProfileSecondLine } from '../menu/useProfileSecondLine';

const NAME_CLASS_NAME = 'max-w-full text-lg leading-6 font-semibold tracking-tight break-words';

const PHOTO_HINT_CLASS_NAME = 'flex items-start gap-2 text-sm leading-5 text-pretty text-on-panel-muted';

const COMPANY_LINK_CLASS_NAME = [
  'inline-flex min-h-11 items-center rounded-control text-base text-link underline underline-offset-2',
  'hover:text-on-panel',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
].join(' ');

export interface ProfileMyProfileProps {
  onDismiss: () => void;
}

export const ProfileMyProfile = ({ onDismiss }: ProfileMyProfileProps): ReactElement => {
  const { t } = useI18n();
  const summaryState = useProfileSummary();
  const secondLine = useProfileSecondLine();
  const canViewNetwork = useCan(PermissionCode.NETWORK_VIEW);
  const rootRef = useRef<HTMLDivElement>(null);

  const isReady = summaryState.kind === 'ready';

  const handleCompanyCardClick = (): void => {
    console.log('> ProfileMyProfile -> handleCompanyCardClick:', {});
    onDismiss();
  };

  useEffect(() => {
    if (isReady) {
      rootRef.current?.querySelector('button')?.focus();
    }
  }, [isReady]);

  if (summaryState.kind === 'pending') {
    return <ProfileMyProfileSkeleton />;
  }

  if (summaryState.kind === 'error') {
    return <p className="w-72 max-w-full text-base leading-6">{t('profile.header.error')}</p>;
  }

  const { organizationId, sides, userAvatarUrl, userDisplayName, userId } = summaryState.summary;

  return (
    <div className="flex w-72 max-w-full flex-col gap-4" ref={rootRef}>
      <div className="flex w-full items-start gap-3">
        <Avatar imageUrl={userAvatarUrl} name={userDisplayName} seed={userId} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <p className={NAME_CLASS_NAME} translate="no">{userDisplayName}</p>
          <p className="max-w-full text-sm leading-5 break-words text-on-panel-muted" translate="no">{secondLine.text}</p>
          <SideBadges sides={sides} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <ChangeAvatarActions avatarUrl={userAvatarUrl} />
        <p className={PHOTO_HINT_CLASS_NAME}>
          <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('profile.myProfile.photoHint')}
        </p>
      </div>
      {canViewNetwork && (
        <div className="border-t border-line pt-2">
          <AddressLink
            className={COMPANY_LINK_CLASS_NAME}
            data-testid="profile-my-profile-company-link"
            onClick={handleCompanyCardClick}
            to={{ kind: 'object', object: { id: organizationId, type: 'organization' } }}
          >
            {t('profile.myProfile.companyCard')}
          </AddressLink>
        </div>
      )}
    </div>
  );
};
