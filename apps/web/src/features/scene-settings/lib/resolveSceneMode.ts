import type { QualityLevelValue } from '@/shared/3d';
import type { ViewportClassValue } from '@/shared/lib/viewport';

import type { GraphicsPreferenceValue } from '../model/graphicsPreference';

import { getDefaultGraphicsPreference } from './getDefaultGraphicsPreference';

export interface ResolveSceneModeInputValue {
  autoLevel: QualityLevelValue | undefined;
  isWebGlAvailable: () => boolean;
  preference: GraphicsPreferenceValue | undefined;
  viewportClass: ViewportClassValue;
}

export type SceneModeValue
  = | { isAuto: boolean; kind: '3d'; level: QualityLevelValue }
    | { kind: 'off'; reason: SceneOffReasonValue };

export type SceneOffReasonValue = 'noWebGl' | 'phoneDefault' | 'preference';

const AUTO_LEVEL_BY_VIEWPORT: Readonly<Record<ViewportClassValue, QualityLevelValue>> = {
  desktop: 'high',
  phone: 'medium',
  tablet: 'medium',
};

export const resolveSceneMode = ({
  autoLevel,
  isWebGlAvailable,
  preference,
  viewportClass,
}: ResolveSceneModeInputValue): SceneModeValue => {
  const effectivePreference = preference ?? getDefaultGraphicsPreference(viewportClass);

  if (preference === 'off') {
    return { kind: 'off', reason: 'preference' };
  }

  if (effectivePreference === 'off') {
    return { kind: 'off', reason: 'phoneDefault' };
  }

  if (!isWebGlAvailable()) {
    return { kind: 'off', reason: 'noWebGl' };
  }

  if (effectivePreference === 'auto') {
    return { isAuto: true, kind: '3d', level: autoLevel ?? AUTO_LEVEL_BY_VIEWPORT[viewportClass] };
  }

  return { isAuto: false, kind: '3d', level: effectivePreference };
};
