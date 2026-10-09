import type { ReactElement } from 'react';

import type { ThemePreferenceValue } from '@/shared/theme';

import { useI18n } from '@/shared/i18n';
import { useThemePreference } from '@/shared/theme';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/shared/ui';

import { THEME_OPTIONS } from '../model/themeOptions';

export const ThemeMenuRadioGroup = (): ReactElement => {
  const { t } = useI18n();
  const { preference, setPreference } = useThemePreference();

  const handleThemeChange = (nextPreference: ThemePreferenceValue): void => {
    console.log('> ThemeMenuRadioGroup -> handleThemeChange:', { nextPreference });
    setPreference(nextPreference);
  };

  return (
    <DropdownMenuRadioGroup label={t('theme.label')} onValueChange={handleThemeChange} value={preference}>
      {THEME_OPTIONS.map(option => (
        <DropdownMenuRadioItem key={option.value} value={option.value}>
          <option.Icon aria-hidden className="size-4" />
          {t(option.labelKey)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
};
