import type { LucideIcon } from 'lucide-react';

import {
  Ban,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Sparkles,
} from 'lucide-react';

import type { GraphicsPreferenceValue } from './graphicsPreference';

export type GraphicsLabelKey = 'graphics.auto' | 'graphics.high' | 'graphics.low' | 'graphics.medium' | 'graphics.off';

export interface GraphicsOptionValue {
  Icon: LucideIcon;
  labelKey: GraphicsLabelKey;
  value: GraphicsPreferenceValue;
}

export const GRAPHICS_OPTIONS: readonly GraphicsOptionValue[] = [
  { Icon: Sparkles, labelKey: 'graphics.auto', value: 'auto' },
  { Icon: SignalHigh, labelKey: 'graphics.high', value: 'high' },
  { Icon: SignalMedium, labelKey: 'graphics.medium', value: 'medium' },
  { Icon: SignalLow, labelKey: 'graphics.low', value: 'low' },
  { Icon: Ban, labelKey: 'graphics.off', value: 'off' },
];
