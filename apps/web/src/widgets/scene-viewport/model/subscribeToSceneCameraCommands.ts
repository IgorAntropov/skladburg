import type { SceneCameraCommandValue } from './useSceneCameraStore';

import { useSceneCameraStore } from './useSceneCameraStore';

export type SceneCameraCommandListener = (command: SceneCameraCommandValue) => void;

export type SceneCameraCommandSubscription = (listener: SceneCameraCommandListener) => () => void;

export const subscribeToSceneCameraCommands: SceneCameraCommandSubscription = (listener) => {
  return useSceneCameraStore.subscribe((current, prev) => {
    if (current.command === undefined || current.command.id === prev.command?.id) {
      return;
    }

    listener(current.command.value);
  });
};
