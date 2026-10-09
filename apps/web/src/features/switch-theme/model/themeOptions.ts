import type { LucideIcon } from 'lucide-react';

import {
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';

import type { ThemePreferenceValue } from '@/shared/theme';

export type ThemeLabelKey = 'theme.dark' | 'theme.light' | 'theme.system';

export interface ThemeOptionValue {
  Icon: LucideIcon;
  labelKey: ThemeLabelKey;
  value: ThemePreferenceValue;
}

export const THEME_OPTIONS: readonly ThemeOptionValue[] = [
  { Icon: Sun, labelKey: 'theme.light', value: 'light' },
  { Icon: Moon, labelKey: 'theme.dark', value: 'dark' },
  { Icon: Monitor, labelKey: 'theme.system', value: 'system' },
];
