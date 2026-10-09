import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasLists } from '../lib/hasLists';
import { hasSlot } from '../lib/hasSlot';
import { HUD_PHONE_MAIN_CLASS_NAME } from './hudStyles';
import { HudZone } from './HudZone';
import { InspectorSheet } from './InspectorSheet';
import { ListsZoneContent } from './ListsZoneContent';

export const PhoneHudLayout = ({
  inspector,
  inspectorKey,
  isInspectorOpen,
  listsHeader,
  listTabs,
  panel,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();

  const isListsShown = hasLists({ listsHeader, listTabs });
  const isPanelShown = hasSlot(panel);
  const isPanelMain = !isListsShown && isPanelShown;

  return (
    <>
      {isListsShown && (
        <HudZone className={HUD_PHONE_MAIN_CLASS_NAME} label={t('hud.lists.label')} testId="hud-zone-lists">
          <ListsZoneContent header={listsHeader} tabs={listTabs} />
        </HudZone>
      )}
      {isPanelMain && (
        <HudZone className={HUD_PHONE_MAIN_CLASS_NAME} label={t('hud.panel.label')} testId="hud-zone-panel">{panel}</HudZone>
      )}
      {isInspectorOpen && <InspectorSheet key={inspectorKey}>{inspector}</InspectorSheet>}
    </>
  );
};
