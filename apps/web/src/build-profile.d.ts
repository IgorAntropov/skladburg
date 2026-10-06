declare module 'virtual:build-profile' {
  export const bundledLocales: readonly import('@/shared/i18n').LocaleCode[];
  export const catalogLoaders: import('@/shared/i18n').CatalogLoadersValue;
  export const defaultLocaleCatalog: import('@/shared/i18n').LocaleCatalogValue;
  export const defaultTenant: import('@/shared/tenant').TenantSettingsValue;
}
