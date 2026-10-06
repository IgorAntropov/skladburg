export interface BuildProfileTenantValue {
  availableLocales: readonly string[];
  brandName: string;
  defaultLocale: string;
  tenantId: string;
  termOverrides: TermOverridesValue;
}

export interface BuildProfileValue {
  bundledLocales: readonly string[];
  defaultTenant: BuildProfileTenantValue;
}

export type TermMessageValue = Readonly<Record<string, string>> | string;

export type TermOverridesValue = Readonly<Record<string, Readonly<Record<string, TermMessageValue>>>>;
