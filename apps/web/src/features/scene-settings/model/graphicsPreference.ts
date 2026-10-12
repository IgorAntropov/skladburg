export type GraphicsPreferenceValue = 'auto' | 'high' | 'low' | 'medium' | 'off';

export const GRAPHICS_STORAGE_KEY = 'graphics-preference';

export const parseGraphicsPreference = (value: unknown): GraphicsPreferenceValue | undefined => {
  const isKnownPreference = value === 'auto' || value === 'high' || value === 'low' || value === 'medium' || value === 'off';

  return isKnownPreference ? value : undefined;
};
