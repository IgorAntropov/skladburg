import {
  useEffect,
  useState,
} from 'react';

import type { SceneModuleValue } from './sceneViewportTypes';

export type PreparedSceneDataStateValue<TData>
  = | { data: TData; kind: 'ready' }
    | { error: unknown; kind: 'failed' }
    | { kind: 'pending' };

interface PreparedSceneDataEntryValue<TData, TInteraction> {
  data: TData;
  sceneModule: SceneModuleValue<TData, TInteraction>;
}

const PENDING_STATE = { kind: 'pending' } as const;

export const usePreparedSceneData = <TData, TInteraction>(
  sceneModule: SceneModuleValue<TData, TInteraction> | undefined,
  sceneData: TData | undefined,
): PreparedSceneDataStateValue<TData> => {
  const [prepared, setPrepared] = useState<PreparedSceneDataEntryValue<TData, TInteraction> | undefined>(undefined);
  const [failure, setFailure] = useState<undefined | { error: unknown }>(undefined);

  useEffect(() => {
    if (sceneModule === undefined || sceneData === undefined) {
      return undefined;
    }

    let isCancelled = false;

    sceneModule.prepare(sceneData).then(
      () => {
        if (!isCancelled) {
          setPrepared({ data: sceneData, sceneModule });
        }
      },
      (error: unknown) => {
        console.log('> usePreparedSceneData -> prepare:', { error });

        if (!isCancelled) {
          setFailure({ error });
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [sceneData, sceneModule]);

  if (failure !== undefined) {
    return { error: failure.error, kind: 'failed' };
  }

  if (prepared === undefined || prepared.sceneModule !== sceneModule) {
    return PENDING_STATE;
  }

  return { data: prepared.data, kind: 'ready' };
};
