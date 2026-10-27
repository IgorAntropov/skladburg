import type { ReactElement } from 'react';

import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import {
  Button,
  useAnnounce,
} from '@/shared/ui';

import {
  getAppUpdateMessageKey,
  isAppUpdateNoticeVisible,
} from './appUpdateNoticeState';
import {
  ACTIONS_CLASS_NAME,
  ICON_BADGE_CLASS_NAME,
  MESSAGE_CLASS_NAME,
  NOTICE_CLASS_NAME,
} from './appUpdateNoticeStyles';
import { useAppUpdate } from './useAppUpdate';

export const AppUpdateNoticePanel = (): null | ReactElement => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const reloadPage = useReloadPage();
  const { apply, dismiss, state } = useAppUpdate();

  const isApplying = state === 'applying';
  const isReloadRequired = state === 'reloadRequired';
  const isNoticeVisible = isAppUpdateNoticeVisible(state);
  const message = t(getAppUpdateMessageKey(state));

  const handleApplyClick = (): void => {
    console.log('> AppUpdateNoticePanel -> handleApplyClick:', { state });
    apply();
  };

  const handleReloadClick = (): void => {
    console.log('> AppUpdateNoticePanel -> handleReloadClick:', { state });
    reloadPage();
  };

  const handleDismissClick = (): void => {
    console.log('> AppUpdateNoticePanel -> handleDismissClick:', { state });
    dismiss();
  };

  useEffect(() => {
    if (state === 'ready' || state === 'reloadRequired') {
      announce(message);
    }
  }, [announce, message, state]);

  if (!isNoticeVisible) {
    return null;
  }

  return (
    <aside aria-label={message} className={NOTICE_CLASS_NAME}>
      <div className={MESSAGE_CLASS_NAME}>
        <span aria-hidden className={ICON_BADGE_CLASS_NAME}>
          <RefreshCw className="size-4" />
        </span>
        <p className="min-w-0 text-sm leading-5 font-medium">{message}</p>
      </div>
      <div className={ACTIONS_CLASS_NAME}>
        {isReloadRequired
          ? (
              <Button onClick={handleReloadClick} size="md" variant="primary">
                {t('routing.chunkError.reload')}
              </Button>
            )
          : (
              <>
                <Button
                  onClick={handleApplyClick}
                  pending={isApplying}
                  pendingLabel={t('app.update.applying')}
                  size="md"
                  variant="primary"
                >
                  {t('app.update.apply')}
                </Button>
                <Button disabled={isApplying} onClick={handleDismissClick} size="md" variant="ghost">
                  {t('app.update.dismiss')}
                </Button>
              </>
            )}
      </div>
    </aside>
  );
};
