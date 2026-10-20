import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasLists } from '../lib/hasLists';
import { hasSlot } from '../lib/hasSlot';
import {
  HUD_INTERACTIVE_CLASS_NAME,
  HUD_PHONE_MAIN_CLASS_NAME,
} from './hudStyles';
import { HudZone } from './HudZone';
import { InspectorSheet } from './InspectorSheet';
import { ListsZoneContent } from './ListsZoneContent';

const MAIN_ZONE_CLASS_NAME = cn(HUD_INTERACTIVE_CLASS_NAME, HUD_PHONE_MAIN_CLASS_NAME);

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
  const isPanelMain = isPanelShown;
  const isListsMain = isListsShown && !isPanelShown;

  return (
    <>
      {isListsMain && (
        <HudZone className={MAIN_ZONE_CLASS_NAME} label={t('hud.lists.label')}>
          <ListsZoneContent header={listsHeader} tabs={listTabs} />
        </HudZone>
      )}
      {isPanelMain && (
        <HudZone className={MAIN_ZONE_CLASS_NAME} label={t('hud.panel.label')}>{panel}</HudZone>
      )}
      {isInspectorOpen && (
        <InspectorSheet key={inspectorKey}>{inspector}</InspectorSheet>
      )}
    </>
  );
};
