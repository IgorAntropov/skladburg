export interface ShadowSettingsValue {
  bias: number;
  mapSize: number;
  normalBias: number;
  radius: number;
}

export const SHADOW_SETTINGS: ShadowSettingsValue = {
  bias: -0.0004,
  mapSize: 2048,
  normalBias: 0.05,
  radius: 1,
};
