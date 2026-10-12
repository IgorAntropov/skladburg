import type {
  ForbiddenPackageViolationValue,
  InitialBundleValue,
} from './bundleBudgetTypes.ts';

import { extractPackageName } from './extractPackageName.ts';

export type ForbiddenPackageMatcherFunction = (packageName: string) => boolean;

const SCOPE_WILDCARD_SUFFIX = '/*';

const SCOPE_PATTERN = /^@[^/*\s]+\/\*$/;

const EXACT_NAME_PATTERN = /^[^*\s]+$/;

const isScopeWildcard = (pattern: string): boolean => pattern.endsWith(SCOPE_WILDCARD_SUFFIX);

export const assertValidForbiddenPackages = (patterns: readonly string[]): void => {
  for (const pattern of patterns) {
    const isValid = isScopeWildcard(pattern) ? SCOPE_PATTERN.test(pattern) : EXACT_NAME_PATTERN.test(pattern);

    if (!isValid) {
      throw new Error(
        `Forbidden package pattern must be an exact package name or a scope wildcard like "@scope/*", got "${pattern}"`,
      );
    }
  }
};

export const createForbiddenPackageMatcher = (patterns: readonly string[]): ForbiddenPackageMatcherFunction => {
  const exactNames = new Set(patterns.filter(pattern => !isScopeWildcard(pattern)));
  const scopePrefixes = patterns
    .filter(isScopeWildcard)
    .map(pattern => pattern.slice(0, pattern.length - 1));

  return packageName =>
    exactNames.has(packageName) || scopePrefixes.some(prefix => packageName.startsWith(prefix));
};

export const findForbiddenPackageViolations = (
  initialBundle: InitialBundleValue,
  moduleIdsByFileName: ReadonlyMap<string, readonly string[]>,
  isForbidden: ForbiddenPackageMatcherFunction,
): ForbiddenPackageViolationValue[] =>
  initialBundle.chunks.flatMap((chunk) => {
    const packageNames = new Set<string>();

    for (const moduleId of moduleIdsByFileName.get(chunk.fileName) ?? []) {
      const packageName = extractPackageName(moduleId);

      if (packageName !== undefined && isForbidden(packageName)) {
        packageNames.add(packageName);
      }
    }

    return [...packageNames].map(packageName => ({
      chunkFileName: chunk.fileName,
      entryFileName: initialBundle.entryFileName,
      packageName,
    }));
  });
