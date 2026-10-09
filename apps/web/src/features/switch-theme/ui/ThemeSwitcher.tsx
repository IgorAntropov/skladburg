import type { ReactElement } from 'react';

import type { ThemePreferenceValue } from '@/shared/theme';
import type { SegmentedControlOptionValue } from '@/shared/ui';

import { useI18n } from '@/shared/i18n';
import { useThemePreference } from '@/shared/theme';
import { SegmentedControl } from '@/shared/ui';

import { THEME_OPTIONS } from '../model/themeOptions';

export const ThemeSwitcher = (): ReactElement => {
  const { t } = useI18n();
  const { preference, setPreference } = useThemePreference();

  const options = THEME_OPTIONS.map((option): SegmentedControlOptionValue<ThemePreferenceValue> => ({
    icon: <option.Icon className="size-4" />,
    label: t(option.labelKey),
    value: option.value,
  }));

  const handleThemeChange = (nextPreference: ThemePreferenceValue): void => {
    console.log('> ThemeSwitcher -> handleThemeChange:', { nextPreference });
    setPreference(nextPreference);
  };

  return (
    <SegmentedControl
      isLabelHidden
      label={t('theme.label')}
      onValueChange={handleThemeChange}
      options={options}
      value={preference}
    />
  );
};
