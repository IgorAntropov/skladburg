import type { GraphicsPreferenceValue } from './graphicsPreference';

import {
  GRAPHICS_STORAGE_KEY,
  parseGraphicsPreference,
} from './graphicsPreference';

export interface PersistedSceneSettingsValue {
  preference: GraphicsPreferenceValue | undefined;
}

export interface StoredSceneSettingsValue {
  state: PersistedSceneSettingsValue;
  version: number;
}

const STORAGE_VERSION = 0;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const parseStoredSceneSettings = (rawValue: string): StoredSceneSettingsValue => {
  const parsedValue: unknown = JSON.parse(rawValue);
  const storedState = isRecord(parsedValue) ? parsedValue.state : undefined;
  const preference = isRecord(storedState) ? parseGraphicsPreference(storedState.preference) : undefined;

  return { state: { preference }, version: STORAGE_VERSION };
};

export const readStoredPreference = (): GraphicsPreferenceValue | undefined => {
  try {
    const rawValue = window.localStorage.getItem(GRAPHICS_STORAGE_KEY);

    return rawValue === null ? undefined : parseStoredSceneSettings(rawValue).state.preference;
  }
  catch (error: unknown) {
    console.error('> graphicsPreferenceStorage -> readStoredPreference:', { error });

    return undefined;
  }
};

export const writeStoredPreference = (preference: GraphicsPreferenceValue): void => {
  try {
    const value: StoredSceneSettingsValue = { state: { preference }, version: STORAGE_VERSION };

    window.localStorage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(value));
  }
  catch (error: unknown) {
    console.error('> graphicsPreferenceStorage -> writeStoredPreference:', { error });
  }
};
