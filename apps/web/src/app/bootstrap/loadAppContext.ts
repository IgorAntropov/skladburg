import type {
  CatalogLoadersValue,
  ILocalizer,
  LocaleCode,
} from '@/shared/i18n';
import type { TenantSettingsValue } from '@/shared/tenant';

import { createLocalizer } from '@/shared/i18n';
import { createStaticTenantSettingsSource } from '@/shared/tenant';

export interface AppContextValue {
  localizer: ILocalizer;
  tenantSettings: TenantSettingsValue;
}

export interface LoadAppContextOptionsValue {
  bundledLocales: readonly LocaleCode[];
  catalogLoaders: CatalogLoadersValue;
  defaultTenant: TenantSettingsValue;
}

export const loadAppContext = async ({
  bundledLocales,
  catalogLoaders,
  defaultTenant,
}: LoadAppContextOptionsValue): Promise<AppContextValue> => {
  const tenantSettingsSource = createStaticTenantSettingsSource([defaultTenant]);
  const tenantSettings = await tenantSettingsSource.getTenantSettings(defaultTenant.tenantId);
  const localizer = await createLocalizer({
    bundledLocales,
    catalogLoaders,
    requestedLocale: undefined,
    tenant: tenantSettings,
  });

  return { localizer, tenantSettings };
};
