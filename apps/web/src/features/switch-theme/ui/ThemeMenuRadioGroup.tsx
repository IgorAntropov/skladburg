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
  '[&>[role=menuitemradio][aria-checked=true]:not([data-highlighted])]:bg-skeleton',
  '[&>[role=menuitemradio]]:justify-center',
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
          <DropdownMenuRadioItem
            indicatorPlacement="none"
            key={option.value}
            label={t(option.labelKey)}
            value={option.value}
          >
            <option.Icon aria-hidden className="size-5 in-aria-checked:text-indicator" />
          </DropdownMenuRadioItem>
        ))}
      </div>
    </DropdownMenuRadioGroup>
  );
};
