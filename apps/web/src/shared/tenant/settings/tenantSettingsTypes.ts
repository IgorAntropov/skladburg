import type {
  LocaleCode,
  TermOverridesValue,
} from '@/shared/i18n';

export interface TenantSettingsValue {
  availableLocales: readonly LocaleCode[];
  brandName: string;
  defaultLocale: LocaleCode;
  tenantId: string;
  termOverrides: TermOverridesValue;
}
