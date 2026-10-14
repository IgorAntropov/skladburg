export type ShadowMapSizeValue = 2048 | 4096;

export interface ShadowSettingsValue {
  bias: number;
  normalBias: number;
  radius: number;
}

const SHADOW_BIAS = -0.0004;
const SHADOW_NORMAL_BIAS = 0.05;

export const SHADOW_SETTINGS_BY_MAP_SIZE: Readonly<Record<ShadowMapSizeValue, ShadowSettingsValue>> = {
  2048: { bias: SHADOW_BIAS, normalBias: SHADOW_NORMAL_BIAS, radius: 1 },
  4096: { bias: SHADOW_BIAS, normalBias: SHADOW_NORMAL_BIAS, radius: 2 },
};
