import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  lazy,
  useState,
} from 'react';

import type { CachedModuleLoader } from './createCachedModuleLoader';

export const createLazyComponent = <TProps extends object>(
  loader: CachedModuleLoader<{ default: ComponentType<TProps> }>,
): ComponentType<TProps> => {
  const PendingComponent = lazy(loader);

  const LazyComponent = (props: TProps): ReactElement => {
    const [LoadedComponent] = useState(() => loader.peekLoadedModule()?.default);

    if (LoadedComponent !== undefined) {
      return <LoadedComponent {...props} />;
    }

    return <PendingComponent {...props} />;
  };

  return LazyComponent;
};
