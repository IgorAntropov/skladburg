import { create } from 'zustand';

import type { QualityLevelValue } from '@/shared/3d';

import type { GraphicsPreferenceValue } from './graphicsPreference';

import {
  readStoredPreference,
  writeStoredPreference,
} from './graphicsPreferenceStorage';

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

export const useSceneSettingsStore = create<SceneSettingsState>()(set => ({
  autoLevel: undefined,
  autoLevelChangeCount: 0,
  isSceneUnavailable: false,
  markSceneUnavailable: () => {
    set({ isSceneUnavailable: true });
  },
  preference: readStoredPreference(),
  reportAutoLevel: (level, source) => {
    set(state => ({
      autoLevel: level,
      autoLevelChangeCount: source === 'measured' ? state.autoLevelChangeCount + 1 : state.autoLevelChangeCount,
    }));
  },
  setPreference: (preference) => {
    writeStoredPreference(preference);
    set({ isSceneUnavailable: false, preference });
  },
}));
