import type { ReactElement } from 'react';

import { Map as MapIcon } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { IconButton } from '@/shared/ui';

import { useHudPanelsStore } from '../model/useHudPanelsStore';
import { useIsHudPanelsToggleAvailable } from '../model/useIsHudPanelsToggleAvailable';

const BUTTON_CLASS_NAME = [
  'sm:hidden',
  'aria-pressed:border-indicator aria-pressed:bg-hover aria-pressed:text-indicator aria-pressed:ring-1 aria-pressed:ring-indicator',
].join(' ');

export const CollapseHudPanelsButton = (): null | ReactElement => {
  const { t } = useI18n();
  const isAvailable = useIsHudPanelsToggleAvailable();
  const isCollapsed = useHudPanelsStore(state => state.isCollapsed);
  const toggleCollapsed = useHudPanelsStore(state => state.toggleCollapsed);

  const handleToggleClick = (): void => {
    console.log('> CollapseHudPanelsButton -> handleToggleClick:', { isCollapsed });
    toggleCollapsed();
  };

  if (!isAvailable) {
    return null;
  }

  return (
    <IconButton
      aria-pressed={isCollapsed}
      className={BUTTON_CLASS_NAME}
      data-testid="top-bar-panels-toggle"
      icon={<MapIcon className="size-5" />}
      label={t('hud.panels.mapView')}
      onClick={handleToggleClick}
      variant="ghost"
    />
  );
};
