import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { useViewportClass } from '@/shared/lib/viewport';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/shared/ui';

import type { GraphicsPreferenceValue } from '../model/graphicsPreference';

import { getDefaultGraphicsPreference } from '../lib/getDefaultGraphicsPreference';
import { GRAPHICS_OPTIONS } from '../model/graphicsOptions';
import { useSceneSettingsStore } from '../model/useSceneSettingsStore';

const GRAPHICS_ROW_CLASS_NAME = [
  'grid grid-cols-5 gap-1',
  '[&>[role=menuitemradio]]:border [&>[role=menuitemradio]]:border-transparent',
  '[&>[role=menuitemradio][aria-checked=true]]:border-indicator',
  '[&>[role=menuitemradio][aria-checked=true]:not([data-highlighted])]:bg-hover',
  '[&>[role=menuitemradio]]:flex-col [&>[role=menuitemradio]]:justify-center [&>[role=menuitemradio]]:gap-1',
  '[&>[role=menuitemradio]]:min-w-0 [&>[role=menuitemradio]]:px-0.5',
].join(' ');

const GRAPHICS_LABEL_CLASS_NAME = [
  'max-w-full text-center text-xs leading-4 font-medium break-words text-on-panel-muted',
  'in-aria-checked:font-semibold in-aria-checked:text-on-panel',
].join(' ');

export const GraphicsMenuRadioGroup = (): ReactElement => {
  const { t } = useI18n();
  const viewportClass = useViewportClass();
  const preference = useSceneSettingsStore(state => state.preference);
  const setPreference = useSceneSettingsStore(state => state.setPreference);

  const checkedPreference = preference ?? getDefaultGraphicsPreference(viewportClass);

  const handleGraphicsChange = (nextPreference: GraphicsPreferenceValue): void => {
    console.log('> GraphicsMenuRadioGroup -> handleGraphicsChange:', { nextPreference });
    setPreference(nextPreference);
  };

  return (
    <DropdownMenuRadioGroup label={t('graphics.label')} onValueChange={handleGraphicsChange} value={checkedPreference}>
      <div className={GRAPHICS_ROW_CLASS_NAME}>
        {GRAPHICS_OPTIONS.map(option => (
          <DropdownMenuRadioItem
            indicatorPlacement="none"
            key={option.value}
            testId={`graphics-menu-option-${option.value}`}
            value={option.value}
          >
            <option.Icon aria-hidden className="size-5 in-aria-checked:text-indicator" />
            <span className={GRAPHICS_LABEL_CLASS_NAME}>{t(option.labelKey)}</span>
          </DropdownMenuRadioItem>
        ))}
      </div>
    </DropdownMenuRadioGroup>
  );
};
