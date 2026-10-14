import type { ThirdPartyLicenseValue } from './licenseTypes.ts';

const HEADER = 'Licenses of the third-party packages included in this build.';

const SEPARATOR = '-'.repeat(72);

const formatLicense = (license: ThirdPartyLicenseValue): string => {
  const repositoryLines = license.repository === undefined ? [] : [`Repository: ${license.repository}`];

  return [
    `${license.name} ${license.version}`,
    `License: ${license.license}`,
    ...repositoryLines,
    '',
    license.text,
    '',
    SEPARATOR,
  ].join('\n');
};

export const formatThirdPartyLicenses = (licenses: readonly ThirdPartyLicenseValue[]): string =>
  `${[HEADER, SEPARATOR, ...licenses.map(formatLicense)].join('\n\n')}\n`;
