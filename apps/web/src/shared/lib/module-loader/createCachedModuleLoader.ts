import { ChunkLoadError } from './ChunkLoadError';

export type CachedModuleLoader<TModule> = () => Promise<TModule>;

export interface CachedModuleLoaderOptionsValue {
  mapLoadError?: MapLoadErrorFunction | undefined;
}

export interface ChunkLoadFailureValue {
  attempt: number;
  cause: unknown;
}

export type MapLoadErrorFunction = (failure: ChunkLoadFailureValue) => ChunkLoadError;

export type ModuleLoader<TModule> = () => Promise<TModule>;

const createChunkLoadError: MapLoadErrorFunction = ({ attempt, cause }) => new ChunkLoadError(attempt, undefined, { cause });

const createLoadedModule = <TModule>(loadedModule: TModule): Promise<TModule> => {
  const resolved = Promise.resolve(loadedModule);

  const then = <TResult1 = TModule, TResult2 = never>(
    onFulfilled?: ((module: TModule) => PromiseLike<TResult1> | TResult1) | null,
    onRejected?: ((reason: unknown) => PromiseLike<TResult2> | TResult2) | null,
  ): Promise<TResult1 | TResult2> => {
    if (onFulfilled === undefined || onFulfilled === null) {
      return Promise.resolve(loadedModule).then(onFulfilled, onRejected);
    }

    return new Promise<TResult1 | TResult2>((resolve) => {
      resolve(onFulfilled(loadedModule));
    });
  };

  return Object.assign(resolved, { then });
};

export const createCachedModuleLoader = <TModule>(
  loader: ModuleLoader<TModule>,
  options?: CachedModuleLoaderOptionsValue,
): CachedModuleLoader<TModule> => {
  const mapLoadError = options?.mapLoadError ?? createChunkLoadError;
  let failureCount = 0;
  let loadedModule: undefined | { module: TModule };
  let pendingModule: Promise<TModule> | undefined;

  return () => {
    if (loadedModule !== undefined) {
      return createLoadedModule(loadedModule.module);
    }

    pendingModule ??= loader().then(
      (module) => {
        loadedModule = { module };

        return module;
      },
      (error: unknown) => {
        pendingModule = undefined;
        failureCount += 1;

        throw mapLoadError({ attempt: failureCount, cause: error });
      },
    );

    return pendingModule;
  };
};
