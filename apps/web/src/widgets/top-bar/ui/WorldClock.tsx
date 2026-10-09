import type { ReactElement } from 'react';

import { Pause } from 'lucide-react';
import {
  useEffect,
  useMemo,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import { useWorldClockQuery } from '../api/useWorldClockQuery';
import { useWorldClockMinute } from '../lib/useWorldClockMinute';

const ROOT_CLASS_NAME = [
  'flex min-h-5 shrink-0 items-center gap-1.5 whitespace-nowrap text-sm leading-5 text-on-panel',
  'sm:min-h-6 sm:text-base sm:leading-6',
].join(' ');

const TIME_CLASS_NAME = 'min-w-[2.8em] text-center font-medium tabular-nums';

const SCALE_CLASS_NAME = 'rounded-control border border-line px-1.5 text-xs leading-4 font-medium tabular-nums text-on-panel-muted';

const PAUSE_ICON_CLASS_NAME = 'size-3 shrink-0 text-on-panel-muted';

const BADGE_WITH_ICON_CLASS_NAME = 'inline-flex items-center gap-1';

const SKELETON_CLASS_NAME = 'h-4 w-[2.8em] sm:h-5';

export const WorldClock = (): null | ReactElement => {
  const { formatDateTime, formatNumber, t, userTimeZone } = useI18n();
  const clockQuery = useWorldClockQuery();
  const minuteMs = useWorldClockMinute(clockQuery.data);

  const isClockUnavailable = clockQuery.data === undefined && clockQuery.isError;
  const isClockWaiting = minuteMs === undefined && !isClockUnavailable;
  const isSkeletonFilled = useDelayedVisibility(isClockWaiting);

  const timeScale = clockQuery.data?.snapshot.timeScale;
  const isPaused = timeScale === 0;
  const isBadgeShown = timeScale !== undefined && timeScale !== 1 && !isClockWaiting;

  const timeText = useMemo(
    () => (minuteMs === undefined ? '' : formatDateTime(minuteMs, { timeZone: userTimeZone })),
    [formatDateTime, minuteMs, userTimeZone],
  );
  const dateTimeValue = minuteMs === undefined ? undefined : new Date(minuteMs).toISOString();
  const scale = isBadgeShown ? formatNumber(timeScale) : '';
  const badgeText = isPaused ? t('clock.paused') : t('clock.scale', { scale });
  const badgeLabel = isPaused ? t('clock.paused.label') : t('clock.scale.label', { scale });

  useEffect(() => {
    if (clockQuery.error !== null) {
      console.log('> WorldClock -> reportClockError:', { message: clockQuery.error.message });
    }
  }, [clockQuery.error]);

  if (isClockUnavailable) {
    return null;
  }

  return (
    <div aria-label={t('clock.label')} className={ROOT_CLASS_NAME} data-testid="top-bar-clock-slot" role="group">
      {isClockWaiting
        ? (
            <SkeletonGroup isFilled={isSkeletonFilled} label={t('clock.loading')}>
              <Skeleton className={SKELETON_CLASS_NAME} />
            </SkeletonGroup>
          )
        : <time className={TIME_CLASS_NAME} dateTime={dateTimeValue}>{timeText}</time>}
      {isBadgeShown
        ? (
            <>
              <span aria-hidden className={cn(SCALE_CLASS_NAME, isPaused && BADGE_WITH_ICON_CLASS_NAME)}>
                {isPaused && <Pause aria-hidden className={PAUSE_ICON_CLASS_NAME} />}
                {badgeText}
              </span>
              <span className="sr-only">{badgeLabel}</span>
            </>
          )
        : null}
    </div>
  );
};
