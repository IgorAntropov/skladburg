import type { Plugin } from 'vite';

export interface CollectedLicensesValue {
  licenses: ThirdPartyLicenseValue[];
  violations: string[];
}

export interface ExtraLicensePackageValue {
  name: string;
  resolveFrom: readonly string[];
}

export interface FallbackLicenseTextValue {
  files: readonly string[];
  license: string;
  name: string;
}

export interface PackageManifestValue {
  license: string | undefined;
  name: string;
  repository: string | undefined;
  version: string;
}

export interface ThirdPartyLicensesOptionsValue {
  allowedLicenses: readonly string[];
  appRoot: string;
  extraPackages: readonly ExtraLicensePackageValue[];
  fallbackDirectory?: string | undefined;
  fallbackTexts?: readonly FallbackLicenseTextValue[] | undefined;
  fileName: string;
}

export interface ThirdPartyLicensesValue {
  plugin: Plugin;
  workerPlugin: () => Plugin;
}

export interface ThirdPartyLicenseValue {
  license: string;
  name: string;
  repository: string | undefined;
  text: string;
  version: string;
}
