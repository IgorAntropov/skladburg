import type {
  ComponentType,
  LazyExoticComponent,
} from 'react';

import { lazy } from 'react';

import type {
  AppSectionValue,
  ObjectRefValue,
} from '@/shared/routing';

export type CachedSectionLoader = () => PromiseLike<SectionModuleValue>;

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

const toLazyLoader = (loader: CachedSectionLoader): SectionLoader => () => loader() as Promise<SectionModuleValue>;

export const createSectionPages = (loaders: CachedSectionLoadersValue): SectionPagesValue => ({
  catalog: lazy(toLazyLoader(loaders.catalog)),
  deals: lazy(toLazyLoader(loaders.deals)),
  network: lazy(toLazyLoader(loaders.network)),
  warehouse: lazy(toLazyLoader(loaders.warehouse)),
});
