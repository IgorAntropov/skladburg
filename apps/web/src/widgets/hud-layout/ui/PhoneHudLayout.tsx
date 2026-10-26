import type { ReactElement } from 'react';

import { useState } from 'react';

import {
  useCollapsibleHudPanels,
  useHudPanelsCollapseSignal,
} from '@/features/collapse-hud-panels';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasLists } from '../lib/hasLists';
import { hasSlot } from '../lib/hasSlot';
import {
  HUD_INTERACTIVE_CLASS_NAME,
  HUD_PHONE_MAIN_CLASS_NAME,
  HUD_PHONE_RISE_CLASS_NAME,
} from './hudStyles';
import { HudZone } from './HudZone';
import { InspectorSheet } from './InspectorSheet';
import { ListsZoneContent } from './ListsZoneContent';

const MAIN_ZONE_CLASS_NAME = cn(HUD_INTERACTIVE_CLASS_NAME, HUD_PHONE_MAIN_CLASS_NAME);

const REVEALED_MAIN_ZONE_CLASS_NAME = cn(MAIN_ZONE_CLASS_NAME, HUD_PHONE_RISE_CLASS_NAME);

export const PhoneHudLayout = ({
  canCollapsePanels,
  defaultListTabId,
  inspector,
  inspectorKey,
  isInspectorOpen,
  listsHeader,
  listTabs,
  listTabsResetKey,
  panel,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();
  const isCollapsed = useCollapsibleHudPanels(canCollapsePanels === true);
  const collapseSignal = useHudPanelsCollapseSignal();
  const [isRevealed, setIsRevealed] = useState(false);
  const [prevIsCollapsed, setPrevIsCollapsed] = useState(isCollapsed);

  if (prevIsCollapsed !== isCollapsed) {
    setPrevIsCollapsed(isCollapsed);

    if (!isCollapsed) {
      setIsRevealed(true);
    }
  }

  const mainZoneClassName = isRevealed ? REVEALED_MAIN_ZONE_CLASS_NAME : MAIN_ZONE_CLASS_NAME;
  const isListsShown = hasLists({ listsHeader, listTabs });
  const isPanelShown = hasSlot(panel);
  const isPanelMain = isPanelShown;
  const isListsMain = isListsShown && !isPanelShown;

  return (
    <>
      {isListsMain && (
        <HudZone className={mainZoneClassName} hidden={isCollapsed} label={t('hud.lists.label')}>
          <ListsZoneContent defaultTabId={defaultListTabId} header={listsHeader} resetKey={listTabsResetKey} tabs={listTabs} />
        </HudZone>
      )}
      {isPanelMain && (
        <HudZone className={mainZoneClassName} hidden={isCollapsed} label={t('hud.panel.label')}>{panel}</HudZone>
      )}
      {isInspectorOpen && (
        <InspectorSheet collapseSignal={collapseSignal} isCollapseRequested={isCollapsed} key={inspectorKey}>
          {inspector}
        </InspectorSheet>
      )}
    </>
  );
};
