import type { ReactElement } from 'react';

import type { ThemePreferenceValue } from '@/shared/theme';

import { useI18n } from '@/shared/i18n';
import { useThemePreference } from '@/shared/theme';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/shared/ui';

import { THEME_OPTIONS } from '../model/themeOptions';

const THEME_ROW_CLASS_NAME = [
  'grid grid-cols-3 gap-1.5',
  '[&>[role=menuitemradio]]:border [&>[role=menuitemradio]]:border-transparent',
  '[&>[role=menuitemradio][aria-checked=true]]:border-indicator',
  '[&>[role=menuitemradio][aria-checked=true]:not([data-highlighted])]:bg-hover',
  '[&>[role=menuitemradio]]:flex-col [&>[role=menuitemradio]]:justify-center [&>[role=menuitemradio]]:gap-1',
  '[&>[role=menuitemradio]]:px-1',
].join(' ');

const THEME_LABEL_CLASS_NAME = [
  'text-center text-xs leading-4 font-medium text-on-panel-muted',
  'in-aria-checked:font-semibold in-aria-checked:text-on-panel',
].join(' ');

export const ThemeMenuRadioGroup = (): ReactElement => {
  const { t } = useI18n();
  const { preference, setPreference } = useThemePreference();

  const handleThemeChange = (nextPreference: ThemePreferenceValue): void => {
    console.log('> ThemeMenuRadioGroup -> handleThemeChange:', { nextPreference });
    setPreference(nextPreference);
  };

  return (
    <DropdownMenuRadioGroup label={t('theme.label')} onValueChange={handleThemeChange} value={preference}>
      <div className={THEME_ROW_CLASS_NAME}>
        {THEME_OPTIONS.map(option => (
          <DropdownMenuRadioItem indicatorPlacement="none" key={option.value} value={option.value}>
            <option.Icon aria-hidden className="size-5 in-aria-checked:text-indicator" />
            <span className={THEME_LABEL_CLASS_NAME}>{t(option.labelKey)}</span>
          </DropdownMenuRadioItem>
        ))}
      </div>
    </DropdownMenuRadioGroup>
  );
};
