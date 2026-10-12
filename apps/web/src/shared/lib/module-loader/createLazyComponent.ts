import type {
  ComponentType,
  LazyExoticComponent,
} from 'react';

import { lazy } from 'react';

import type { CachedModuleLoader } from './createCachedModuleLoader';

export const createLazyComponent = <TProps>(
  loader: CachedModuleLoader<{ default: ComponentType<TProps> }>,
): LazyExoticComponent<ComponentType<TProps>> => {
  return lazy(loader);
};
