export interface QualityLevelSettingsValue {
  decorDensity: number;
  dpr: readonly [number, number];
}

export type QualityLevelValue = 'high' | 'low' | 'medium';

export const QUALITY_LEVEL_SETTINGS: Readonly<Record<QualityLevelValue, QualityLevelSettingsValue>> = {
  high: { decorDensity: 1, dpr: [1, 2] },
  low: { decorDensity: 0.3, dpr: [1, 1] },
  medium: { decorDensity: 0.6, dpr: [1, 1.5] },
};
