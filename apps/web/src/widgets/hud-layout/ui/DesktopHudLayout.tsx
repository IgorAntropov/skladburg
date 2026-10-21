import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasLists } from '../lib/hasLists';
import { hasSlot } from '../lib/hasSlot';
import { HudFreeArea } from './HudFreeArea';
import {
  HUD_DESKTOP_CENTER_COLUMN_CLASS_NAME,
  HUD_DESKTOP_FREE_AREA_CLASS_NAME,
  HUD_DESKTOP_INSPECTOR_ZONE_CLASS_NAME,
  HUD_DESKTOP_KPI_ZONE_CLASS_NAME,
  HUD_DESKTOP_LISTS_ZONE_CLASS_NAME,
  HUD_DESKTOP_OVERLAY_CLASS_NAME,
  HUD_DESKTOP_PANEL_ZONE_CLASS_NAME,
  HUD_DESKTOP_SCENE_CONTROLS_CLASS_NAME,
  HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME,
  HUD_DESKTOP_TRACKER_ZONE_CLASS_NAME,
  HUD_INTERACTIVE_CLASS_NAME,
} from './hudStyles';
import { HudZone } from './HudZone';
import { ListsZoneContent } from './ListsZoneContent';

export const DesktopHudLayout = ({
  defaultListTabId,
  freeAreaRef,
  inspector,
  kpi,
  listsHeader,
  listTabs,
  listTabsResetKey,
  panel,
  sceneControls,
  tracker,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();

  const isKpiShown = hasSlot(kpi);
  const isTrackerShown = hasSlot(tracker);
  const isListsShown = hasLists({ listsHeader, listTabs });
  const isPanelShown = hasSlot(panel);
  const isSceneControlsShown = hasSlot(sceneControls);
  const isLeftColumnShown = isKpiShown || isTrackerShown;

  return (
    <div className={HUD_DESKTOP_OVERLAY_CLASS_NAME}>
      {isLeftColumnShown && (
        <div className={HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME}>
          {isKpiShown && (
            <HudZone className={cn(HUD_INTERACTIVE_CLASS_NAME, HUD_DESKTOP_KPI_ZONE_CLASS_NAME)} label={t('hud.kpi.label')}>
              {kpi}
            </HudZone>
          )}
          {isTrackerShown && (
            <HudZone
              className={cn(HUD_INTERACTIVE_CLASS_NAME, HUD_DESKTOP_TRACKER_ZONE_CLASS_NAME)}
              label={t('hud.tracker.label')}

            >
              {tracker}
            </HudZone>
          )}
        </div>
      )}
      <div className={HUD_DESKTOP_CENTER_COLUMN_CLASS_NAME}>
        {isPanelShown && (
          <HudZone
            className={cn(HUD_INTERACTIVE_CLASS_NAME, HUD_DESKTOP_PANEL_ZONE_CLASS_NAME)}
            label={t('hud.panel.label')}

          >
            {panel}
          </HudZone>
        )}
        <HudFreeArea className={HUD_DESKTOP_FREE_AREA_CLASS_NAME} ref={freeAreaRef} />
        {isSceneControlsShown && (
          <div className={HUD_DESKTOP_SCENE_CONTROLS_CLASS_NAME}>{sceneControls}</div>
        )}
      </div>
      <div className={cn(HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME, 'ml-auto')}>
        <HudZone
          className={cn(HUD_INTERACTIVE_CLASS_NAME, HUD_DESKTOP_INSPECTOR_ZONE_CLASS_NAME)}
          label={t('hud.inspector.title')}

        >
          {inspector}
        </HudZone>
        {isListsShown && (
          <HudZone
            className={cn(HUD_INTERACTIVE_CLASS_NAME, HUD_DESKTOP_LISTS_ZONE_CLASS_NAME)}
            label={t('hud.lists.label')}

          >
            <ListsZoneContent defaultTabId={defaultListTabId} header={listsHeader} resetKey={listTabsResetKey} tabs={listTabs} />
          </HudZone>
        )}
      </div>
    </div>
  );
};
