import { create } from 'zustand';

import {
  readStoredQuietMode,
  writeStoredQuietMode,
} from './quietModeStorage';

interface AssistantQuietModeState {
  isQuiet: boolean;
  setQuiet: (isQuiet: boolean) => void;
}

export const useAssistantQuietModeStore = create<AssistantQuietModeState>()(set => ({
  isQuiet: readStoredQuietMode(),
  setQuiet: (isQuiet) => {
    writeStoredQuietMode(isQuiet);
    set({ isQuiet });
  },
}));
