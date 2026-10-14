import type { QualityLevelValue } from '@/shared/3d';
import type { ViewportClassValue } from '@/shared/lib/viewport';

import type { GraphicsPreferenceValue } from '../model/graphicsPreference';

import { getDefaultGraphicsPreference } from './getDefaultGraphicsPreference';

export interface ResolveSceneModeInputValue {
  autoLevel: QualityLevelValue | undefined;
  isSoftwareRenderer: () => boolean;
  isWebGlAvailable: () => boolean;
  preference: GraphicsPreferenceValue | undefined;
  viewportClass: ViewportClassValue;
}

export type SceneModeValue
  = | { autoCeiling: QualityLevelValue; isAuto: true; kind: '3d'; level: QualityLevelValue }
    | { isAuto: false; kind: '3d'; level: QualityLevelValue }
    | { kind: 'off'; reason: SceneOffReasonValue };

export type SceneOffReasonValue = 'noWebGl' | 'phoneDefault' | 'preference';

const AUTO_CEILING_BY_VIEWPORT: Readonly<Record<ViewportClassValue, QualityLevelValue>> = {
  desktop: 'high',
  phone: 'medium',
  tablet: 'medium',
};

const SOFTWARE_AUTO_CEILING: QualityLevelValue = 'low';

const LEVEL_RANK: Readonly<Record<QualityLevelValue, number>> = {
  high: 2,
  low: 0,
  medium: 1,
};

const clampToCeiling = (level: QualityLevelValue, ceiling: QualityLevelValue): QualityLevelValue =>
  LEVEL_RANK[level] > LEVEL_RANK[ceiling] ? ceiling : level;

export const resolveSceneMode = ({
  autoLevel,
  isSoftwareRenderer,
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
    const autoCeiling = isSoftwareRenderer() ? SOFTWARE_AUTO_CEILING : AUTO_CEILING_BY_VIEWPORT[viewportClass];

    return {
      autoCeiling,
      isAuto: true,
      kind: '3d',
      level: autoLevel === undefined ? autoCeiling : clampToCeiling(autoLevel, autoCeiling),
    };
  }

  return { isAuto: false, kind: '3d', level: effectivePreference };
};
