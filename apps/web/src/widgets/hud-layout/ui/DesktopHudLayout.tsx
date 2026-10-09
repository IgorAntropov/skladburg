import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasLists } from '../lib/hasLists';
import { hasSlot } from '../lib/hasSlot';
import {
  HUD_DESKTOP_CENTER_COLUMN_CLASS_NAME,
  HUD_DESKTOP_INSPECTOR_ZONE_CLASS_NAME,
  HUD_DESKTOP_KPI_ZONE_CLASS_NAME,
  HUD_DESKTOP_LISTS_ZONE_CLASS_NAME,
  HUD_DESKTOP_OVERLAY_CLASS_NAME,
  HUD_DESKTOP_PANEL_ZONE_CLASS_NAME,
  HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME,
  HUD_DESKTOP_TRACKER_ZONE_CLASS_NAME,
} from './hudStyles';
import { HudZone } from './HudZone';
import { ListsZoneContent } from './ListsZoneContent';

const ZONE_CLASS_NAME = 'pointer-events-auto';

export const DesktopHudLayout = ({
  inspector,
  kpi,
  listsHeader,
  listTabs,
  panel,
  tracker,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();

  const isKpiShown = hasSlot(kpi);
  const isTrackerShown = hasSlot(tracker);
  const isListsShown = hasLists({ listsHeader, listTabs });
  const isPanelShown = hasSlot(panel);
  const isLeftColumnShown = isKpiShown || isTrackerShown;

  return (
    <div className={HUD_DESKTOP_OVERLAY_CLASS_NAME}>
      {isLeftColumnShown && (
        <div className={HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME}>
          {isKpiShown && (
            <HudZone className={cn(ZONE_CLASS_NAME, HUD_DESKTOP_KPI_ZONE_CLASS_NAME)} label={t('hud.kpi.label')} testId="hud-zone-kpi">
              {kpi}
            </HudZone>
          )}
          {isTrackerShown && (
            <HudZone
              className={cn(ZONE_CLASS_NAME, HUD_DESKTOP_TRACKER_ZONE_CLASS_NAME)}
              label={t('hud.tracker.label')}
              testId="hud-zone-tracker"
            >
              {tracker}
            </HudZone>
          )}
        </div>
      )}
      {isPanelShown && (
        <div className={HUD_DESKTOP_CENTER_COLUMN_CLASS_NAME}>
          <HudZone
            className={cn(ZONE_CLASS_NAME, HUD_DESKTOP_PANEL_ZONE_CLASS_NAME)}
            label={t('hud.panel.label')}
            testId="hud-zone-panel"
          >
            {panel}
          </HudZone>
        </div>
      )}
      <div className={cn(HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME, 'ml-auto')}>
        <HudZone
          className={cn(ZONE_CLASS_NAME, HUD_DESKTOP_INSPECTOR_ZONE_CLASS_NAME)}
          label={t('hud.inspector.title')}
          testId="hud-zone-inspector"
        >
          {inspector}
        </HudZone>
        {isListsShown && (
          <HudZone
            className={cn(ZONE_CLASS_NAME, HUD_DESKTOP_LISTS_ZONE_CLASS_NAME)}
            label={t('hud.lists.label')}
            testId="hud-zone-lists"
          >
            <ListsZoneContent header={listsHeader} tabs={listTabs} />
          </HudZone>
        )}
      </div>
    </div>
  );
};
