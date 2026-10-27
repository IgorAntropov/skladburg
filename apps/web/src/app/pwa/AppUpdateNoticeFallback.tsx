import type { ReactElement } from 'react';

import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import {
  Button,
  useAnnounce,
} from '@/shared/ui';

import { getAppUpdateMessageKey } from './appUpdateNoticeState';
import {
  ACTIONS_CLASS_NAME,
  MESSAGE_CLASS_NAME,
  NOTICE_CLASS_NAME,
} from './appUpdateNoticeStyles';
import { useAppUpdate } from './useAppUpdate';

export const AppUpdateNoticeFallback = (): ReactElement => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const reloadPage = useReloadPage();
  const { apply, state } = useAppUpdate();

  const isApplying = state === 'applying';
  const isReloadRequired = state === 'reloadRequired';
  const message = t(getAppUpdateMessageKey(state));

  const handleReloadClick = (): void => {
    console.log('> AppUpdateNoticeFallback -> handleReloadClick:', { state });

    if (isReloadRequired) {
      reloadPage();

      return;
    }

    apply();
  };

  useEffect(() => {
    if (state === 'ready' || isReloadRequired) {
      announce(message);
    }
  }, [announce, isReloadRequired, message, state]);

  return (
    <aside aria-label={message} className={NOTICE_CLASS_NAME}>
      <div className={MESSAGE_CLASS_NAME}>
        <p className="min-w-0 text-sm leading-5 font-medium">{message}</p>
      </div>
      <div className={ACTIONS_CLASS_NAME}>
        <Button
          onClick={handleReloadClick}
          pending={isApplying}
          pendingLabel={t('app.update.applying')}
          size="md"
          variant="primary"
        >
          {t('routing.chunkError.reload')}
        </Button>
      </div>
    </aside>
  );
};
