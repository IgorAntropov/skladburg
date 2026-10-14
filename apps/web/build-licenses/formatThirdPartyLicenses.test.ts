import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ThirdPartyLicenseValue } from './licenseTypes.ts';

import { formatThirdPartyLicenses } from './formatThirdPartyLicenses.ts';

const idb: ThirdPartyLicenseValue = {
  license: 'ISC',
  name: 'idb',
  repository: 'https://github.com/jakearchibald/idb',
  text: 'ISC License\n\nCopyright (c) Jake',
  version: '8.0.4',
};

const react: ThirdPartyLicenseValue = {
  license: 'MIT',
  name: 'react',
  repository: undefined,
  text: 'MIT License',
  version: '19.3.0',
};

describe('formatThirdPartyLicenses', () => {
  it('writes a header, then name with version, license, repository and text of every package', () => {
    const output = formatThirdPartyLicenses([idb, react]);

    expect(output.startsWith('Licenses of the third-party packages included in this build.\n')).toBe(true);
    expect(output).toContain(
      'idb 8.0.4\nLicense: ISC\nRepository: https://github.com/jakearchibald/idb\n\nISC License\n\nCopyright (c) Jake\n',
    );
    expect(output).toContain('react 19.3.0\nLicense: MIT\n\nMIT License\n');
    expect(output).not.toContain('Repository: undefined');
  });

  it('keeps the order it was given and ends with a single newline', () => {
    const output = formatThirdPartyLicenses([idb, react]);

    expect(output.indexOf('idb 8.0.4')).toBeLessThan(output.indexOf('react 19.3.0'));
    expect(output.endsWith('MIT License\n\n------------------------------------------------------------------------\n')).toBe(true);
  });

  it('writes only the header for an empty list', () => {
    const output = formatThirdPartyLicenses([]);

    expect(output.split('\n\n')).toHaveLength(2);
    expect(output.startsWith('Licenses of the third-party packages included in this build.\n\n---')).toBe(true);
  });
});
