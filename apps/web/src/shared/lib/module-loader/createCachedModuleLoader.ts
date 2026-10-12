import { ChunkLoadError } from './ChunkLoadError';

export interface CachedModuleLoader<TModule> {
  (): Promise<TModule>;
  peekLoadedModule: () => TModule | undefined;
}

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

export const createCachedModuleLoader = <TModule>(
  loader: ModuleLoader<TModule>,
  options?: CachedModuleLoaderOptionsValue,
): CachedModuleLoader<TModule> => {
  const mapLoadError = options?.mapLoadError ?? createChunkLoadError;
  let failureCount = 0;
  let loadedModule: undefined | { module: TModule };
  let pendingModule: Promise<TModule> | undefined;

  const load = (): Promise<TModule> => {
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

  const peekLoadedModule = (): TModule | undefined => loadedModule?.module;

  return Object.assign(load, { peekLoadedModule });
};
