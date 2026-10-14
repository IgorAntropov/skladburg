export interface QualityLevelSettingsValue {
  decorDensity: number;
  dpr: readonly [number, number];
  hasShadows: boolean;
}

export type QualityLevelValue = 'high' | 'low' | 'medium';

export const QUALITY_LEVEL_SETTINGS: Readonly<Record<QualityLevelValue, QualityLevelSettingsValue>> = {
  high: { decorDensity: 1, dpr: [1, 2], hasShadows: true },
  low: { decorDensity: 0.3, dpr: [1, 1], hasShadows: false },
  medium: { decorDensity: 0.6, dpr: [1, 1.5], hasShadows: false },
};

export const QUALITY_LEVELS_ASCENDING: readonly QualityLevelValue[] = ['low', 'medium', 'high'];

export const rankOf = (level: QualityLevelValue): number => QUALITY_LEVELS_ASCENDING.indexOf(level);
