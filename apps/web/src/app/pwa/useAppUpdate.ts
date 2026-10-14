import {
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import type {
  AppUpdateStateValue,
  IAppUpdateSource,
} from './appUpdateTypes';

import { AppUpdateContext } from './AppUpdateContext';

export interface AppUpdateHandleValue {
  apply: () => void;
  dismiss: () => void;
  state: AppUpdateStateValue;
}

const doNothing = (): void => undefined;

const IDLE_SOURCE: IAppUpdateSource = {
  apply: doNothing,
  dismiss: doNothing,
  getState: () => 'idle',
  subscribe: () => doNothing,
};

export const useAppUpdate = (): AppUpdateHandleValue => {
  const source = useContext(AppUpdateContext) ?? IDLE_SOURCE;
  const state = useSyncExternalStore(source.subscribe, source.getState);

  return useMemo(
    (): AppUpdateHandleValue => ({ apply: source.apply, dismiss: source.dismiss, state }),
    [source.apply, source.dismiss, state],
  );
};
