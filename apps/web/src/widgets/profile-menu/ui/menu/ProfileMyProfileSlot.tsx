import type {
  KeyboardEvent,
  ReactElement,
} from 'react';

import { TriangleAlert } from 'lucide-react';
import {
  useEffect,
  useRef,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import { Button } from '@/shared/ui';

import { useLoadedModule } from '../../lib/useLoadedModule';
import { loadProfileMyProfile } from '../loadProfileMyProfile';
import { ProfileMyProfileSkeleton } from './ProfileMyProfileSkeleton';

const ERROR_BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export interface ProfileMyProfileSlotProps {
  onClose: () => void;
  onDismiss: () => void;
}

export const ProfileMyProfileSlot = ({ onClose, onDismiss }: ProfileMyProfileSlotProps): ReactElement => {
  const { t } = useI18n();
  const reloadPage = useReloadPage();
  const { isRetrying, retry, state } = useLoadedModule(loadProfileMyProfile);
  const recoveryButtonRef = useRef<HTMLButtonElement>(null);

  const isFailed = state.kind === 'failed';
  const isReload = state.kind === 'failed' && state.recovery === 'reload';

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') {
      return;
    }
    console.log('> ProfileMyProfileSlot -> handleKeyDown:', {});
    event.stopPropagation();
    onClose();
  };

  const handleReloadClick = (): void => {
    console.log('> ProfileMyProfileSlot -> handleReloadClick:', {});
    reloadPage();
  };

  const handleRetryClick = (): void => {
    console.log('> ProfileMyProfileSlot -> handleRetryClick:', {});
    retry();
  };

  useEffect(() => {
    if (isFailed) {
      recoveryButtonRef.current?.focus();
    }
  }, [isFailed]);

  const LoadedProfileMyProfile = state.kind === 'loaded' ? state.module.ProfileMyProfile : undefined;

  return (
    <div
      aria-label={t('profile.myProfile.title')}
      data-testid="profile-my-profile"
      onKeyDown={handleKeyDown}
      role="group"
    >
      {state.kind === 'loading' && <ProfileMyProfileSkeleton />}
      {LoadedProfileMyProfile !== undefined && <LoadedProfileMyProfile onDismiss={onDismiss} />}
      {isFailed && (
        <div className="flex w-72 max-w-full flex-col items-start gap-3">
          <div className="flex items-start gap-2">
            <span aria-hidden className={ERROR_BADGE_CLASS_NAME}>
              <TriangleAlert className="size-4" />
            </span>
            <p className="text-base leading-6" role="alert">
              {isReload ? t('profile.myProfile.loadError.repeated') : t('profile.myProfile.loadError.message')}
            </p>
          </div>
          {isReload
            ? <Button onClick={handleReloadClick} ref={recoveryButtonRef} variant="secondary">{t('routing.chunkError.reload')}</Button>
            : (
                <Button
                  onClick={handleRetryClick}
                  pending={isRetrying}
                  pendingLabel={t('common.retrying')}
                  ref={recoveryButtonRef}
                  variant="secondary"
                >
                  {t('common.retry')}
                </Button>
              )}
        </div>
      )}
    </div>
  );
};
