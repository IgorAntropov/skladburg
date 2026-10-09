import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import { useI18n } from '@/shared/i18n';
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

const TIME_CLASS_NAME = 'min-w-[2.65em] text-center font-medium tabular-nums';

const SCALE_CLASS_NAME = 'rounded-control border border-line px-1.5 text-xs leading-4 font-medium tabular-nums text-on-panel-muted';

const SKELETON_CLASS_NAME = 'h-4 w-[2.65em] sm:h-5';

export const WorldClock = (): null | ReactElement => {
  const { formatDateTime, formatNumber, t, userTimeZone } = useI18n();
  const clockQuery = useWorldClockQuery();
  const minuteMs = useWorldClockMinute(clockQuery.data);

  const isClockUnavailable = clockQuery.data === undefined && clockQuery.isError;
  const isClockWaiting = minuteMs === undefined && !isClockUnavailable;
  const isSkeletonFilled = useDelayedVisibility(isClockWaiting);

  const timeScale = clockQuery.data?.snapshot.timeScale;
  const isScaleShown = timeScale !== undefined && timeScale !== 1;

  const timeText = useMemo(
    () => (minuteMs === undefined ? '' : formatDateTime(minuteMs, { timeZone: userTimeZone })),
    [formatDateTime, minuteMs, userTimeZone],
  );
  const dateTimeValue = useMemo(() => (minuteMs === undefined ? undefined : new Date(minuteMs).toISOString()), [minuteMs]);
  const isScaleBadgeShown = isScaleShown && !isClockWaiting;
  const scaleText = isScaleShown ? formatNumber(timeScale) : '';

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
      {isScaleBadgeShown
        ? (
            <>
              <span aria-hidden className={SCALE_CLASS_NAME}>{t('clock.scale', { scale: scaleText })}</span>
              <span className="sr-only">{t('clock.scale.label', { scale: scaleText })}</span>
            </>
          )
        : null}
    </div>
  );
};
