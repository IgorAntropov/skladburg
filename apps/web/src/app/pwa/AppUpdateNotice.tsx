import type { ReactElement } from 'react';

import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import { useReloadPage } from '@/shared/routing';
import {
  Button,
  useAnnounce,
} from '@/shared/ui';

import { useAppUpdate } from './useAppUpdate';

const NOTICE_CLASS_NAME = [
  'fixed z-10 flex flex-col gap-3 rounded-panel border border-line bg-panel-solid p-4 text-on-panel shadow-raised',
  'top-[calc(var(--top-bar-row-min-height)+1px+env(safe-area-inset-top)+0.75rem)] right-[max(0.75rem,env(safe-area-inset-right))]',
  'w-max max-w-[min(36rem,calc(100vw-1.5rem))] [--menu-in-y:-4px] motion-safe:animate-menu-in',
  'max-sm:left-[max(0.75rem,env(safe-area-inset-left))] max-sm:w-auto max-sm:max-w-none',
  'sm:flex-row sm:items-center sm:gap-4',
].join(' ');

const MESSAGE_CLASS_NAME = 'flex min-w-0 items-center gap-3';

const ICON_BADGE_CLASS_NAME = 'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary';

const ACTIONS_CLASS_NAME = 'flex items-center gap-2 max-sm:*:flex-1 sm:shrink-0';

export const AppUpdateNotice = (): null | ReactElement => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const reloadPage = useReloadPage();
  const { apply, dismiss, state } = useAppUpdate();

  const isApplying = state === 'applying';
  const isReloadRequired = state === 'reloadRequired';
  const isNoticeVisible = state === 'ready' || isApplying || isReloadRequired;
  const message = isReloadRequired ? t('app.update.reloadRequired') : t('app.update.ready');

  const handleApplyClick = (): void => {
    console.log('> AppUpdateNotice -> handleApplyClick:', { state });
    apply();
  };

  const handleReloadClick = (): void => {
    console.log('> AppUpdateNotice -> handleReloadClick:', { state });
    reloadPage();
  };

  const handleDismissClick = (): void => {
    console.log('> AppUpdateNotice -> handleDismissClick:', { state });
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
