import type { AppSectionValue } from '@/shared/routing';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import type {
  CachedSectionLoader,
  CachedSectionLoadersValue,
  SectionLoader,
  SectionLoadersValue,
} from './sectionPages';

import { SectionChunkLoadError } from './SectionChunkLoadError';

const createCachedSectionLoader = (section: AppSectionValue, loader: SectionLoader): CachedSectionLoader => {
  return createCachedModuleLoader(loader, error => new SectionChunkLoadError(section, { cause: error }));
};

export const createCachedSectionLoaders = (loaders: SectionLoadersValue): CachedSectionLoadersValue => {
  return {
    catalog: createCachedSectionLoader('catalog', loaders.catalog),
    deals: createCachedSectionLoader('deals', loaders.deals),
    network: createCachedSectionLoader('network', loaders.network),
    warehouse: createCachedSectionLoader('warehouse', loaders.warehouse),
  };
};
