import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CATALOGS_DIRECTORY,
  PROFILES_DIRECTORY,
} from './buildProfilePaths.ts';

export interface TempAppRootOptionsValue {
  catalogs?: readonly string[];
  profiles?: Readonly<Record<string, unknown>>;
}

export interface TempAppRootValue {
  appRoot: string;
  remove: () => void;
}

export const createTempAppRoot = ({ catalogs = [], profiles = {} }: TempAppRootOptionsValue = {}): TempAppRootValue => {
  const appRoot = mkdtempSync(join(tmpdir(), 'build-profile-'));

  mkdirSync(join(appRoot, PROFILES_DIRECTORY), { recursive: true });
  mkdirSync(join(appRoot, CATALOGS_DIRECTORY), { recursive: true });

  for (const [name, profile] of Object.entries(profiles)) {
    const text = typeof profile === 'string' ? profile : JSON.stringify(profile);

    writeFileSync(join(appRoot, PROFILES_DIRECTORY, `${name}.json`), text);
  }

  for (const locale of catalogs) {
    writeFileSync(join(appRoot, CATALOGS_DIRECTORY, `${locale}.ts`), 'export const catalog = {};\n');
  }

  return {
    appRoot,
    remove: (): void => {
      rmSync(appRoot, { force: true, recursive: true });
    },
  };
};

export const createValidProfile = (
  tenantPatch: Readonly<Record<string, unknown>> = {},
  profilePatch: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  bundledLocales: ['ru', 'en'],
  defaultTenant: {
    availableLocales: ['ru', 'en'],
    brandName: 'Северный склад',
    defaultLocale: 'ru',
    tenantId: 'f1000001-0000-4000-8000-000000000000',
    termOverrides: {},
    ...tenantPatch,
  },
  ...profilePatch,
});
