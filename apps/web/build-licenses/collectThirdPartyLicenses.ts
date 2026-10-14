import type { PackageRootCacheValue } from './findPackageRoot.ts';
import type {
  CollectedLicensesValue,
  ExtraLicensePackageValue,
  FallbackLicenseTextValue,
  PackageManifestValue,
  ThirdPartyLicenseValue,
} from './licenseTypes.ts';

import { findLicenseText } from './findLicenseFile.ts';
import { findPackageRoot } from './findPackageRoot.ts';
import { isLicenseAllowed } from './isLicenseAllowed.ts';
import { readFallbackLicenseText } from './readFallbackLicenseText.ts';
import { readPackageManifest } from './readPackageManifest.ts';
import { resolvePackageRoot } from './resolvePackageRoot.ts';

export interface CollectThirdPartyLicensesOptionsValue {
  allowedLicenses: readonly string[];
  appRoot: string;
  extraPackages: readonly ExtraLicensePackageValue[];
  fallbackDirectory?: string | undefined;
  fallbackTexts?: readonly FallbackLicenseTextValue[] | undefined;
  moduleIds: Iterable<string>;
}

interface ResolvedLicenseTextValue {
  text: string | undefined;
  violation: string | undefined;
}

const MESSAGE_PREFIX = 'Third-party licenses:';

const OWN_PACKAGE_PREFIX = '@skladburg/';

const NO_LICENSE_FILE_MESSAGE = 'has no license file (LICENSE, LICENCE or COPYING)';

const createUnresolvedMessage = (extraPackage: ExtraLicensePackageValue): string => {
  const chain = [...extraPackage.resolveFrom, extraPackage.name].join(' -> ');

  return `${MESSAGE_PREFIX} ${extraPackage.name} cannot be resolved (${chain})`;
};

const resolveLicenseText = (
  packageRoot: string,
  manifest: PackageManifestValue,
  allowedLicense: string | undefined,
  fallbackDirectory: string,
  fallbackTexts: readonly FallbackLicenseTextValue[],
): ResolvedLicenseTextValue => {
  const key = `${manifest.name}@${manifest.version}`;
  const text = findLicenseText(packageRoot);

  if (text !== undefined) {
    return { text, violation: undefined };
  }

  if (allowedLicense === undefined) {
    return { text: undefined, violation: `${MESSAGE_PREFIX} ${key} ${NO_LICENSE_FILE_MESSAGE}` };
  }

  const lookup = readFallbackLicenseText({
    directory: fallbackDirectory,
    fallbackTexts,
    license: allowedLicense,
    name: manifest.name,
  });

  if (lookup.status === 'found') {
    return { text: lookup.text, violation: undefined };
  }

  const reason = lookup.status === 'rejected' ? lookup.reason : NO_LICENSE_FILE_MESSAGE;

  return { text: undefined, violation: `${MESSAGE_PREFIX} ${key} ${reason}` };
};

const compareText = (current: string, prev: string): number => {
  if (current === prev) {
    return 0;
  }

  return current < prev ? -1 : 1;
};

export const compareLicenses = (current: ThirdPartyLicenseValue, prev: ThirdPartyLicenseValue): number =>
  compareText(current.name, prev.name) || compareText(current.version, prev.version);

export const collectThirdPartyLicenses = ({
  allowedLicenses,
  appRoot,
  extraPackages,
  fallbackDirectory = '',
  fallbackTexts = [],
  moduleIds,
}: CollectThirdPartyLicensesOptionsValue): CollectedLicensesValue => {
  const rootCache: PackageRootCacheValue = new Map();
  const packageRoots = new Set<string>();
  const violations: string[] = [];

  for (const moduleId of moduleIds) {
    const packageRoot = findPackageRoot(moduleId, rootCache);

    if (packageRoot !== undefined) {
      packageRoots.add(packageRoot);
    }
  }

  for (const extraPackage of extraPackages) {
    const packageRoot = resolvePackageRoot(appRoot, extraPackage);

    if (packageRoot === undefined) {
      violations.push(createUnresolvedMessage(extraPackage));
    }
    else {
      packageRoots.add(packageRoot);
    }
  }

  const licensesByKey = new Map<string, ThirdPartyLicenseValue>();
  const rejectedKeys = new Set<string>();

  for (const packageRoot of [...packageRoots].toSorted(compareText)) {
    const manifest = readPackageManifest(packageRoot);

    if (manifest === undefined || manifest.name.startsWith(OWN_PACKAGE_PREFIX)) {
      continue;
    }

    const key = `${manifest.name}@${manifest.version}`;

    if (licensesByKey.has(key) || rejectedKeys.has(key)) {
      continue;
    }

    const packageViolations: string[] = [];
    let allowedLicense: string | undefined;

    if (manifest.license === undefined) {
      packageViolations.push(`${MESSAGE_PREFIX} ${key} has no license field in package.json`);
    }
    else if (!isLicenseAllowed(manifest.license, allowedLicenses)) {
      packageViolations.push(`${MESSAGE_PREFIX} ${key} has license "${manifest.license}" which is not allowed in the bundle`);
    }
    else {
      allowedLicense = manifest.license;
    }

    const { text, violation } = resolveLicenseText(packageRoot, manifest, allowedLicense, fallbackDirectory, fallbackTexts);

    if (violation !== undefined) {
      packageViolations.push(violation);
    }

    if (packageViolations.length > 0 || manifest.license === undefined || text === undefined) {
      rejectedKeys.add(key);
      violations.push(...packageViolations);
      continue;
    }

    licensesByKey.set(key, {
      license: manifest.license,
      name: manifest.name,
      repository: manifest.repository,
      text,
      version: manifest.version,
    });
  }

  return {
    licenses: [...licensesByKey.values()].toSorted(compareLicenses),
    violations,
  };
};
