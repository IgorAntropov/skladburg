import type { ReactElement } from 'react';

import {
  useEffect,
  useState,
} from 'react';

import { loadSceneCameraControls } from '../lib/loadSceneCameraControls';
import { useSceneCameraHotkeys } from '../model/useSceneCameraHotkeys';
import { useSceneCameraStore } from '../model/useSceneCameraStore';

const SceneCameraHotkeys = (): null => {
  useSceneCameraHotkeys();

  return null;
};

const SceneCameraPanelLoader = (): null | ReactElement => {
  const [controlsModule, setControlsModule] = useState(() => loadSceneCameraControls.peekLoadedModule());

  const isLoadRequired = controlsModule === undefined;

  useEffect(() => {
    if (!isLoadRequired) {
      return undefined;
    }

    let isCancelled = false;

    loadSceneCameraControls().then(
      (loadedModule) => {
        if (!isCancelled) {
          setControlsModule(loadedModule);
        }
      },
      (error: unknown) => {
        if (!isCancelled) {
          console.log('> SceneCameraControls -> load:', { error });
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [isLoadRequired]);

  if (controlsModule === undefined) {
    return null;
  }

  return <controlsModule.SceneCameraControlsPanel />;
};

export const SceneCameraControls = (): null | ReactElement => {
  const isCameraReady = useSceneCameraStore(state => state.isCameraReady);

  if (!isCameraReady) {
    return null;
  }

  return (
    <>
      <SceneCameraHotkeys />
      <SceneCameraPanelLoader />
    </>
  );
};
