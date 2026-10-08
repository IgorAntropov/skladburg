import type {
  CachedSectionLoader,
  CachedSectionLoadersValue,
  SectionLoader,
  SectionLoadersValue,
  SectionModuleValue,
} from './sectionPages';

const createLoadedModule = (loadedModule: SectionModuleValue): PromiseLike<SectionModuleValue> => ({
  then<TResult1 = SectionModuleValue, TResult2 = never>(
    onFulfilled: (module: SectionModuleValue) => PromiseLike<TResult1> | TResult1,
  ): PromiseLike<TResult1 | TResult2> {
    return new Promise<TResult1 | TResult2>((resolve) => {
      resolve(onFulfilled(loadedModule));
    });
  },
});

const createCachedSectionLoader = (loader: SectionLoader): CachedSectionLoader => {
  let loadedModule: SectionModuleValue | undefined;
  let pendingModule: Promise<SectionModuleValue> | undefined;

  return () => {
    if (loadedModule !== undefined) {
      return createLoadedModule(loadedModule);
    }

    pendingModule ??= loader().then(
      (module) => {
        loadedModule = module;

        return module;
      },
      (error: unknown) => {
        pendingModule = undefined;

        throw error;
      },
    );

    return pendingModule;
  };
};

export const createCachedSectionLoaders = (loaders: SectionLoadersValue): CachedSectionLoadersValue => {
  return {
    catalog: createCachedSectionLoader(loaders.catalog),
    deals: createCachedSectionLoader(loaders.deals),
    network: createCachedSectionLoader(loaders.network),
    warehouse: createCachedSectionLoader(loaders.warehouse),
  };
};
