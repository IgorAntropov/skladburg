import {
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import type {
  IInstallPromptSource,
  InstallModeValue,
  InstallPromptOutcomeValue,
} from './installTypes';

import { InstallAppContext } from './InstallAppContext';

export interface InstallAppHandleValue {
  mode: InstallModeValue;
  prompt: () => Promise<InstallPromptOutcomeValue>;
}

const doNothing = (): void => undefined;

const UNAVAILABLE_SOURCE: IInstallPromptSource = {
  getMode: () => 'unavailable',
  prompt: () => Promise.resolve('unavailable'),
  subscribe: () => doNothing,
};

export const useInstallApp = (): InstallAppHandleValue => {
  const source = useContext(InstallAppContext) ?? UNAVAILABLE_SOURCE;
  const mode = useSyncExternalStore(source.subscribe, source.getMode);

  return useMemo((): InstallAppHandleValue => ({ mode, prompt: source.prompt }), [mode, source.prompt]);
};
