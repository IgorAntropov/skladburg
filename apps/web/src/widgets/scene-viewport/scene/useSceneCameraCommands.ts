import type { RefObject } from 'react';

import { useEffect } from 'react';

import type { IIsometricCameraRig } from '@/shared/3d';

import type { SceneCameraCommandSubscription } from '../model/subscribeToSceneCameraCommands';
import type { SceneCameraCommandValue } from '../model/useSceneCameraStore';

export const runSceneCameraCommand = (rig: IIsometricCameraRig, command: SceneCameraCommandValue): void => {
  switch (command.kind) {
    case 'home':
      rig.home();
      break;
    case 'rotate':
      rig.rotate(command.direction);
      break;
    case 'zoom':
      rig.zoom(command.direction);
      break;
  }
};

export const useSceneCameraCommands = (
  rigRef: RefObject<IIsometricCameraRig | null>,
  subscribe: SceneCameraCommandSubscription,
): void => {
  useEffect(() => {
    return subscribe((command) => {
      const rig = rigRef.current;

      if (rig === null) {
        return;
      }

      runSceneCameraCommand(rig, command);
    });
  }, [rigRef, subscribe]);
};
