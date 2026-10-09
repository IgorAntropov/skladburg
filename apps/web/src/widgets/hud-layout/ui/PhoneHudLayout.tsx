import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { HudZonesProps } from '../lib/hudLayoutTypes';

import { hasSlot } from '../lib/hasSlot';
import { HUD_SIDE_MARGIN_CLASS_NAME } from './hudStyles';
import { HudZone } from './HudZone';
import { InspectorSheet } from './InspectorSheet';

const MAIN_CLASS_NAME = cn('mt-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] max-h-full', HUD_SIDE_MARGIN_CLASS_NAME);

export const PhoneHudLayout = ({
  inspector,
  inspectorKey,
  isInspectorOpen,
  lists,
  panel,
}: HudZonesProps): ReactElement => {
  const { t } = useI18n();

  const isListsShown = hasSlot(lists);
  const isPanelShown = hasSlot(panel);
  const isPanelMain = !isListsShown && isPanelShown;

  return (
    <>
      {isListsShown && (
        <HudZone className={MAIN_CLASS_NAME} label={t('hud.lists.label')} testId="hud-zone-lists">{lists}</HudZone>
      )}
      {isPanelMain && (
        <HudZone className={MAIN_CLASS_NAME} label={t('hud.panel.label')} testId="hud-zone-panel">{panel}</HudZone>
      )}
      {isInspectorOpen && <InspectorSheet key={inspectorKey}>{inspector}</InspectorSheet>}
    </>
  );
};
