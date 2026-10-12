export type GraphicsPreferenceValue = 'auto' | 'high' | 'low' | 'medium' | 'off';

export const GRAPHICS_STORAGE_KEY = 'graphics-preference';

const toStoredValue = (preference: GraphicsPreferenceValue): string => JSON.stringify({ state: { preference }, version: 0 });

export const createStoreGraphicsPreferenceScript = (preference: GraphicsPreferenceValue): string => (
  `window.localStorage.setItem(${JSON.stringify(GRAPHICS_STORAGE_KEY)}, ${JSON.stringify(toStoredValue(preference))});`
);

export const createStoreGraphicsPreferenceIfAbsentScript = (preference: GraphicsPreferenceValue): string => {
  const readStoredValue = `window.localStorage.getItem(${JSON.stringify(GRAPHICS_STORAGE_KEY)})`;

  return `if (${readStoredValue} === null) { ${createStoreGraphicsPreferenceScript(preference)} }`;
};
