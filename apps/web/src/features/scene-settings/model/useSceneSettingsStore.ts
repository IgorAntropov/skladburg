import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { QualityLevelValue } from '@/shared/3d';

import type { GraphicsPreferenceValue } from './graphicsPreference';
import type { PersistedSceneSettingsValue } from './graphicsPreferenceStorage';

import { GRAPHICS_STORAGE_KEY } from './graphicsPreference';
import { graphicsPreferenceStorage } from './graphicsPreferenceStorage';

interface SceneSettingsState {
  autoLevel: QualityLevelValue | undefined;
  isSceneUnavailable: boolean;
  markSceneUnavailable: () => void;
  preference: GraphicsPreferenceValue | undefined;
  reportAutoLevel: (level: QualityLevelValue) => void;
  setPreference: (preference: GraphicsPreferenceValue) => void;
}

export const useSceneSettingsStore = create<SceneSettingsState>()(
  persist(
    set => ({
      autoLevel: undefined,
      isSceneUnavailable: false,
      markSceneUnavailable: () => {
        set({ isSceneUnavailable: true });
      },
      preference: undefined,
      reportAutoLevel: (level) => {
        set({ autoLevel: level });
      },
      setPreference: (preference) => {
        set({ isSceneUnavailable: false, preference });
      },
    }),
    {
      name: GRAPHICS_STORAGE_KEY,
      partialize: (state): PersistedSceneSettingsValue => ({ preference: state.preference }),
      storage: graphicsPreferenceStorage,
    },
  ),
);
