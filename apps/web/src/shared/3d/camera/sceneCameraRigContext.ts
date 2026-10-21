import type {
  ReactElement,
  ReactNode,
  RefObject,
} from 'react';

import {
  createContext,
  createElement,
  use,
} from 'react';

import type { IIsometricCameraRig } from './cameraTypes';

interface SceneCameraRigProviderProps {
  children: ReactNode;
  rigRef: RefObject<IIsometricCameraRig | null>;
}

const SceneCameraRigContext = createContext<RefObject<IIsometricCameraRig | null> | undefined>(undefined);

export const SceneCameraRigProvider = ({ children, rigRef }: SceneCameraRigProviderProps): ReactElement => {
  return createElement(SceneCameraRigContext, { value: rigRef }, children);
};

export const useSceneCameraRig = (): RefObject<IIsometricCameraRig | null> => {
  const rigRef = use(SceneCameraRigContext);

  if (rigRef === undefined) {
    throw new Error('The scene camera rig is available only inside SceneCameraRigProvider');
  }

  return rigRef;
};
