import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasSlot } from '../lib/hasSlot';
import { HudZone } from './HudZone';

const OVERLAY_CLASS_NAME = [
  'pointer-events-none absolute inset-0 flex gap-4 pt-4',
  'pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]',
].join(' ');

const SIDE_COLUMN_CLASS_NAME = 'flex min-h-0 w-[clamp(18rem,24vw,24rem)] shrink-0 flex-col gap-4';

const CENTER_COLUMN_CLASS_NAME = 'flex min-h-0 min-w-0 flex-1 items-start justify-center';

const ZONE_CLASS_NAME = 'pointer-events-auto';

export const DesktopHudLayout = ({
  inspector,
  kpi,
  lists,
  panel,
  tracker,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();

  const isKpiShown = hasSlot(kpi);
  const isTrackerShown = hasSlot(tracker);
  const isListsShown = hasSlot(lists);
  const isPanelShown = hasSlot(panel);
  const isLeftColumnShown = isKpiShown || isTrackerShown;

  return (
    <div className={OVERLAY_CLASS_NAME}>
      {isLeftColumnShown && (
        <div className={SIDE_COLUMN_CLASS_NAME}>
          {isKpiShown && (
            <HudZone className={cn(ZONE_CLASS_NAME, 'max-h-[45%]')} label={t('hud.kpi.label')} testId="hud-zone-kpi">
              {kpi}
            </HudZone>
          )}
          {isTrackerShown && (
            <HudZone
              className={cn(ZONE_CLASS_NAME, 'mt-auto max-h-[45%]')}
              label={t('hud.tracker.label')}
              testId="hud-zone-tracker"
            >
              {tracker}
            </HudZone>
          )}
        </div>
      )}
      {isPanelShown && (
        <div className={CENTER_COLUMN_CLASS_NAME}>
          <HudZone
            className={cn(ZONE_CLASS_NAME, 'max-h-full w-full max-w-4xl')}
            label={t('hud.panel.label')}
            testId="hud-zone-panel"
          >
            {panel}
          </HudZone>
        </div>
      )}
      <div className={cn(SIDE_COLUMN_CLASS_NAME, 'ml-auto')}>
        <HudZone
          className={cn(ZONE_CLASS_NAME, 'max-h-[55%]')}
          label={t('hud.inspector.title')}
          testId="hud-zone-inspector"
        >
          {inspector}
        </HudZone>
        {isListsShown && (
          <HudZone
            className={cn(ZONE_CLASS_NAME, 'mt-auto max-h-[45%]')}
            label={t('hud.lists.label')}
            testId="hud-zone-lists"
          >
            {lists}
          </HudZone>
        )}
      </div>
    </div>
  );
};
