export interface QualityLevelSettingsValue {
  dpr: readonly [number, number];
}

export type QualityLevelValue = 'high' | 'low' | 'medium';

export const QUALITY_LEVEL_SETTINGS: Readonly<Record<QualityLevelValue, QualityLevelSettingsValue>> = {
  high: { dpr: [1, 2] },
  low: { dpr: [1, 1] },
  medium: { dpr: [1, 1.5] },
};
