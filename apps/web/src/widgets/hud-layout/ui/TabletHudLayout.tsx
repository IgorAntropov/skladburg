import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { TabsItemValue } from '@/shared/ui';

import { useI18n } from '@/shared/i18n';
import { Tabs } from '@/shared/ui';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import {
  hasLists,
  hasListTabs,
} from '../lib/hasLists';
import { hasSlot } from '../lib/hasSlot';
import {
  HUD_TABLET_BOTTOM_ZONE_CLASS_NAME,
  HUD_TABLET_KPI_ZONE_CLASS_NAME,
  HUD_TABLET_MAIN_CLASS_NAME,
  HUD_TABLET_PANEL_ZONE_CLASS_NAME,
} from './hudStyles';
import { HudZone } from './HudZone';
import { InspectorDrawer } from './InspectorDrawer';
import { ListsZoneContent } from './ListsZoneContent';

const BOTTOM_TABS_CLASS_NAME = 'flex min-h-0 flex-1 flex-col [&_[role=tabpanel]]:min-h-32';

const TRACKER_TAB_CLASS_NAME = 'flex flex-1 flex-col @container';

const LIST_TAB_WITH_HEADER_CLASS_NAME = 'flex min-h-0 flex-1 flex-col gap-3';

const withListsHeader = (tab: TabsItemValue, header: ReactNode): TabsItemValue => {
  if (!hasSlot(header)) {
    return tab;
  }

  return {
    ...tab,
    content: (
      <div className={LIST_TAB_WITH_HEADER_CLASS_NAME}>
        {header}
        {tab.content}
      </div>
    ),
  };
};

const toListTabs = (
  listsHeader: ReactNode,
  listTabs: readonly TabsItemValue[] | undefined,
  headerOnlyTab: TabsItemValue,
): readonly TabsItemValue[] => {
  if (hasListTabs(listTabs)) {
    return listTabs.map(tab => withListsHeader(tab, listsHeader));
  }

  return [headerOnlyTab];
};

export const TabletHudLayout = ({
  inspector,
  isInspectorOpen,
  kpi,
  listsHeader,
  listTabs,
  onInspectorClose,
  panel,
  tracker,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();

  const isKpiShown = hasSlot(kpi);
  const isTrackerShown = hasSlot(tracker);
  const isListsShown = hasLists({ listsHeader, listTabs });
  const isPanelShown = hasSlot(panel);
  const isBottomTabbed = isTrackerShown && isListsShown;
  const isTrackerAlone = !isBottomTabbed && isTrackerShown;
  const isListsAlone = !isBottomTabbed && isListsShown;

  const bottomTabs: readonly TabsItemValue[] = isBottomTabbed
    ? [
        {
          content: <div className={TRACKER_TAB_CLASS_NAME} data-testid="hud-zone-tracker">{tracker}</div>,
          id: 'tracker',
          label: t('hud.tracker.label'),
        },
        ...toListTabs(listsHeader, listTabs, {
          content: listsHeader,
          id: 'lists',
          label: t('hud.lists.label'),
        }),
      ]
    : [];

  return (
    <>
      {isKpiShown && (
        <HudZone className={HUD_TABLET_KPI_ZONE_CLASS_NAME} label={t('hud.kpi.label')} testId="hud-zone-kpi">{kpi}</HudZone>
      )}
      <div className={HUD_TABLET_MAIN_CLASS_NAME}>
        {isPanelShown && (
          <HudZone className={HUD_TABLET_PANEL_ZONE_CLASS_NAME} label={t('hud.panel.label')} testId="hud-zone-panel">{panel}</HudZone>
        )}
      </div>
      {isBottomTabbed && (
        <HudZone
          className={HUD_TABLET_BOTTOM_ZONE_CLASS_NAME}
          label={t('hud.bottom.label')}
          padding="flush-edge"
          testId="hud-zone-lists"
        >
          <div className={BOTTOM_TABS_CLASS_NAME} data-testid="hud-bottom-tabs">
            <Tabs items={bottomTabs} label={t('hud.bottom.label')} />
          </div>
        </HudZone>
      )}
      {isTrackerAlone && (
        <HudZone
          className={HUD_TABLET_BOTTOM_ZONE_CLASS_NAME}
          label={t('hud.tracker.label')}
          padding="edge"
          testId="hud-zone-tracker"
        >
          {tracker}
        </HudZone>
      )}
      {isListsAlone && (
        <HudZone
          className={HUD_TABLET_BOTTOM_ZONE_CLASS_NAME}
          label={t('hud.lists.label')}
          padding="edge"
          testId="hud-zone-lists"
        >
          <ListsZoneContent header={listsHeader} tabs={listTabs} />
        </HudZone>
      )}
      {isInspectorOpen && <InspectorDrawer onClose={onInspectorClose}>{inspector}</InspectorDrawer>}
    </>
  );
};
