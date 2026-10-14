import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { QualityLevelValue } from '@/shared/3d';

import type { GraphicsPreferenceValue } from './graphicsPreference';
import type { PersistedSceneSettingsValue } from './graphicsPreferenceStorage';

import { GRAPHICS_STORAGE_KEY } from './graphicsPreference';
import { graphicsPreferenceStorage } from './graphicsPreferenceStorage';

export type AutoLevelSourceValue = 'measured' | 'start';

interface SceneSettingsState {
  autoLevel: QualityLevelValue | undefined;
  autoLevelChangeCount: number;
  isSceneUnavailable: boolean;
  markSceneUnavailable: () => void;
  preference: GraphicsPreferenceValue | undefined;
  reportAutoLevel: (level: QualityLevelValue, source: AutoLevelSourceValue) => void;
  setPreference: (preference: GraphicsPreferenceValue) => void;
}

export const useSceneSettingsStore = create<SceneSettingsState>()(
  persist(
    set => ({
      autoLevel: undefined,
      autoLevelChangeCount: 0,
      isSceneUnavailable: false,
      markSceneUnavailable: () => {
        set({ isSceneUnavailable: true });
      },
      preference: undefined,
      reportAutoLevel: (level, source) => {
        set(state => ({
          autoLevel: level,
          autoLevelChangeCount: source === 'measured' ? state.autoLevelChangeCount + 1 : state.autoLevelChangeCount,
        }));
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
