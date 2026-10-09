export type CachedModuleLoader<TModule> = () => PromiseLike<TModule>;

export type MapLoadErrorFunction = (error: unknown) => unknown;

export type ModuleLoader<TModule> = () => Promise<TModule>;

const createLoadedModule = <TModule>(loadedModule: TModule): PromiseLike<TModule> => ({
  then<TResult1 = TModule, TResult2 = never>(
    onFulfilled?: ((module: TModule) => PromiseLike<TResult1> | TResult1) | null,
    onRejected?: ((reason: unknown) => PromiseLike<TResult2> | TResult2) | null,
  ): PromiseLike<TResult1 | TResult2> {
    if (onFulfilled === undefined || onFulfilled === null) {
      return Promise.resolve(loadedModule).then(onFulfilled, onRejected);
    }

    return new Promise<TResult1 | TResult2>((resolve) => {
      resolve(onFulfilled(loadedModule));
    });
  },
});

export const createCachedModuleLoader = <TModule>(
  loader: ModuleLoader<TModule>,
  mapLoadError?: MapLoadErrorFunction,
): CachedModuleLoader<TModule> => {
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

        throw mapLoadError === undefined ? error : mapLoadError(error);
      },
    );

    return pendingModule;
  };
};

export const toLazyModuleLoader = <TModule>(loader: CachedModuleLoader<TModule>): ModuleLoader<TModule> => {
  return () => loader() as Promise<TModule>;
};
