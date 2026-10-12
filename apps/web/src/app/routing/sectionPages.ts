import type {
  ComponentType,
  LazyExoticComponent,
} from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';
import type {
  AppSectionValue,
  ObjectRefValue,
} from '@/shared/routing';

import { createLazyComponent } from '@/shared/lib/module-loader';

export type CachedSectionLoader = CachedModuleLoader<SectionModuleValue>;

export type CachedSectionLoadersValue = Readonly<Record<AppSectionValue, CachedSectionLoader>>;

export type SectionLoader = () => Promise<SectionModuleValue>;

export type SectionLoadersValue = Readonly<Record<AppSectionValue, SectionLoader>>;

export interface SectionModuleValue {
  default: ComponentType<SectionPageProps>;
}

export interface SectionPageProps {
  focus: ObjectRefValue | undefined;
}

export type SectionPagesValue = Readonly<Record<AppSectionValue, LazyExoticComponent<ComponentType<SectionPageProps>>>>;

export const DEFAULT_SECTION_LOADERS: SectionLoadersValue = {
  catalog: () => import('@/pages/catalog').then(module => ({ default: module.CatalogPage })),
  deals: () => import('@/pages/deals').then(module => ({ default: module.DealsPage })),
  network: () => import('@/pages/network').then(module => ({ default: module.NetworkPage })),
  warehouse: () => import('@/pages/warehouse').then(module => ({ default: module.WarehousePage })),
};

export const createSectionPages = (loaders: CachedSectionLoadersValue): SectionPagesValue => ({
  catalog: createLazyComponent(loaders.catalog),
  deals: createLazyComponent(loaders.deals),
  network: createLazyComponent(loaders.network),
  warehouse: createLazyComponent(loaders.warehouse),
});
