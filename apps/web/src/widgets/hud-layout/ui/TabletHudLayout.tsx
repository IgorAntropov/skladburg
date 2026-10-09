import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { Tabs } from '@/shared/ui';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasSlot } from '../lib/hasSlot';
import { HudZone } from './HudZone';
import { InspectorDrawer } from './InspectorDrawer';

const MAIN_CLASS_NAME = 'flex min-h-0 flex-1 flex-col';

const BOTTOM_ZONE_CLASS_NAME = 'sticky bottom-0 z-10 max-h-[45dvh] shrink-0';

export const TabletHudLayout = ({
  inspector,
  isInspectorOpen,
  kpi,
  lists,
  onInspectorClose,
  panel,
  tracker,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();

  const isKpiShown = hasSlot(kpi);
  const isTrackerShown = hasSlot(tracker);
  const isListsShown = hasSlot(lists);
  const isPanelShown = hasSlot(panel);
  const isBottomTabbed = isTrackerShown && isListsShown;
  const isTrackerAlone = !isBottomTabbed && isTrackerShown;
  const isListsAlone = !isBottomTabbed && isListsShown;

  return (
    <>
      {isKpiShown && (
        <HudZone label={t('hud.kpi.label')} testId="hud-zone-kpi">{kpi}</HudZone>
      )}
      <div className={MAIN_CLASS_NAME}>
        {isPanelShown && (
          <HudZone className="max-h-full" label={t('hud.panel.label')} testId="hud-zone-panel">{panel}</HudZone>
        )}
      </div>
      {isBottomTabbed && (
        <HudZone className={BOTTOM_ZONE_CLASS_NAME} label={t('hud.bottom.label')} padding="flush-edge">
          <Tabs
            items={[
              {
                content: <div className="@container" data-testid="hud-zone-tracker">{tracker}</div>,
                id: 'tracker',
                label: t('hud.tracker.label'),
              },
              {
                content: <div className="@container" data-testid="hud-zone-lists">{lists}</div>,
                id: 'lists',
                label: t('hud.lists.label'),
              },
            ]}
            label={t('hud.bottom.label')}
          />
        </HudZone>
      )}
      {isTrackerAlone && (
        <HudZone
          className={BOTTOM_ZONE_CLASS_NAME}
          label={t('hud.tracker.label')}
          padding="edge"
          testId="hud-zone-tracker"
        >
          {tracker}
        </HudZone>
      )}
      {isListsAlone && (
        <HudZone
          className={BOTTOM_ZONE_CLASS_NAME}
          label={t('hud.lists.label')}
          padding="edge"
          testId="hud-zone-lists"
        >
          {lists}
        </HudZone>
      )}
      {isInspectorOpen && <InspectorDrawer onClose={onInspectorClose}>{inspector}</InspectorDrawer>}
    </>
  );
};
