import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PackageManifestValue } from './licenseTypes.ts';

import { normalizeRepositoryUrl } from './normalizeRepositoryUrl.ts';

const MANIFEST_FILE_NAME = 'package.json';

const DEFAULT_VERSION = '0.0.0';

const readText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const text = value.trim();

  return text === '' ? undefined : text;
};

const readLicense = (value: unknown): string | undefined => {
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return readText(value.type);
  }

  return readText(value);
};

const parseManifest = (source: string): unknown => {
  try {
    return JSON.parse(source);
  }
  catch {
    return undefined;
  }
};

export const readPackageManifest = (packageRoot: string): PackageManifestValue | undefined => {
  let source: string;

  try {
    source = readFileSync(join(packageRoot, MANIFEST_FILE_NAME), 'utf-8');
  }
  catch {
    return undefined;
  }

  const manifest = parseManifest(source);

  if (typeof manifest !== 'object' || manifest === null) {
    return undefined;
  }

  const name = 'name' in manifest ? readText(manifest.name) : undefined;

  if (name === undefined) {
    return undefined;
  }

  return {
    license: 'license' in manifest ? readLicense(manifest.license) : undefined,
    name,
    repository: 'repository' in manifest ? normalizeRepositoryUrl(manifest.repository) : undefined,
    version: ('version' in manifest ? readText(manifest.version) : undefined) ?? DEFAULT_VERSION,
  };
};
