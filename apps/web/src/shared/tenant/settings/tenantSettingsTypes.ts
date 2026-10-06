import type {
  LocaleCode,
  TermOverridesValue,
} from '@/shared/i18n';

export interface ITenantSettingsSource {
  getTenantSettings: (tenantId: string) => Promise<TenantSettingsValue>;
}

export interface TenantSettingsValue {
  availableLocales: readonly LocaleCode[];
  brandName: string;
  defaultLocale: LocaleCode;
  tenantId: string;
  termOverrides: TermOverridesValue;
}
