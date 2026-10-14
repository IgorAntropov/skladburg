import {
  basename,
  dirname,
} from 'node:path';

import { readPackageManifest } from './readPackageManifest.ts';

const NODE_MODULES_SEGMENT = '/node_modules/';

const NODE_MODULES_DIRECTORY = 'node_modules';

const WINDOWS_SEPARATOR_PATTERN = /\\/g;

const VIRTUAL_MODULE_PREFIX = '\0';

export type PackageRootCacheValue = Map<string, string | undefined>;

const toFilePath = (moduleId: string): string => {
  const normalizedId = moduleId.replaceAll(WINDOWS_SEPARATOR_PATTERN, '/');
  const queryStart = normalizedId.indexOf('?');

  return queryStart === -1 ? normalizedId : normalizedId.slice(0, queryStart);
};

const findRootFrom = (directory: string, cache: PackageRootCacheValue): string | undefined => {
  if (basename(directory) === NODE_MODULES_DIRECTORY || dirname(directory) === directory) {
    return undefined;
  }

  if (cache.has(directory)) {
    return cache.get(directory);
  }

  const root = readPackageManifest(directory) === undefined ? findRootFrom(dirname(directory), cache) : directory;

  cache.set(directory, root);

  return root;
};

export const findPackageRoot = (moduleId: string, cache: PackageRootCacheValue): string | undefined => {
  if (moduleId.startsWith(VIRTUAL_MODULE_PREFIX)) {
    return undefined;
  }

  const filePath = toFilePath(moduleId);

  if (!filePath.includes(NODE_MODULES_SEGMENT)) {
    return undefined;
  }

  return findRootFrom(dirname(filePath), cache);
};
