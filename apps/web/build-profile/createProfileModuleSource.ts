import type { BuildProfileValue } from './buildProfileTypes.ts';

import { CATALOGS_DIRECTORY } from './buildProfilePaths.ts';

const DEFAULT_LOCALE_CATALOG_NAME = 'defaultLocaleCatalog';

export const createCatalogImportPath = (locale: string): string => `/${CATALOGS_DIRECTORY}/${locale}.ts`;

const createLazyCatalogLoaderSource = (locale: string): string => {
  return `  ${JSON.stringify(locale)}: () => import(${JSON.stringify(createCatalogImportPath(locale))}).then((module) => module.catalog),`;
};

const createDefaultCatalogLoaderSource = (locale: string): string => {
  return `  ${JSON.stringify(locale)}: () => Promise.resolve(${DEFAULT_LOCALE_CATALOG_NAME}),`;
};

export const createProfileModuleSource = ({ bundledLocales, defaultTenant }: BuildProfileValue): string => {
  const { defaultLocale } = defaultTenant;
  const catalogLoaders = bundledLocales
    .map(locale => (locale === defaultLocale ? createDefaultCatalogLoaderSource(locale) : createLazyCatalogLoaderSource(locale)))
    .join('\n');

  return [
    `import { catalog as ${DEFAULT_LOCALE_CATALOG_NAME} } from ${JSON.stringify(createCatalogImportPath(defaultLocale))};`,
    '',
    `export { ${DEFAULT_LOCALE_CATALOG_NAME} };`,
    `export const bundledLocales = ${JSON.stringify(bundledLocales)};`,
    `export const defaultTenant = ${JSON.stringify(defaultTenant, undefined, 2)};`,
    `export const catalogLoaders = {\n${catalogLoaders}\n};`,
    '',
  ].join('\n');
};
