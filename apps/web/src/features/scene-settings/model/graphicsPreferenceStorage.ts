import type {
  PersistStorage,
  StorageValue,
} from 'zustand/middleware';

import type { GraphicsPreferenceValue } from './graphicsPreference';

import { parseGraphicsPreference } from './graphicsPreference';

export interface PersistedSceneSettingsValue {
  preference: GraphicsPreferenceValue | undefined;
}

const STORAGE_VERSION = 0;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const parseStoredSceneSettings = (rawValue: string): StorageValue<PersistedSceneSettingsValue> => {
  const parsedValue: unknown = JSON.parse(rawValue);
  const storedState = isRecord(parsedValue) ? parsedValue.state : undefined;
  const preference = isRecord(storedState) ? parseGraphicsPreference(storedState.preference) : undefined;

  return { state: { preference }, version: STORAGE_VERSION };
};

export const graphicsPreferenceStorage: PersistStorage<PersistedSceneSettingsValue> = {
  getItem: (name) => {
    try {
      const rawValue = window.localStorage.getItem(name);

      return rawValue === null ? null : parseStoredSceneSettings(rawValue);
    }
    catch (error: unknown) {
      console.error('> graphicsPreferenceStorage -> getItem:', { error });

      return null;
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    }
    catch (error: unknown) {
      console.error('> graphicsPreferenceStorage -> removeItem:', { error });
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    }
    catch (error: unknown) {
      console.error('> graphicsPreferenceStorage -> setItem:', { error });
    }
  },
};
