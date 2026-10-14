import {
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { ALLOWED_BUNDLE_LICENSES } from './allowedBundleLicenses.ts';
import {
  FALLBACK_LICENSE_TEXTS,
  FALLBACK_LICENSE_TEXTS_DIRECTORY,
} from './fallbackLicenseTexts.ts';
import { isLicenseAllowed } from './isLicenseAllowed.ts';

const listedFiles = FALLBACK_LICENSE_TEXTS.flatMap(entry => entry.files);

describe('FALLBACK_LICENSE_TEXTS', () => {
  it('points every entry to existing non-empty files', () => {
    for (const file of listedFiles) {
      const text = readFileSync(join(FALLBACK_LICENSE_TEXTS_DIRECTORY, file), 'utf-8');

      expect(text.trim(), file).not.toBe('');
    }
  });

  it('lists every file of the folder exactly once', () => {
    expect(listedFiles.toSorted()).toEqual(readdirSync(FALLBACK_LICENSE_TEXTS_DIRECTORY).toSorted());
  });

  it('has one entry per package, with files and an allowed license', () => {
    const names = FALLBACK_LICENSE_TEXTS.map(entry => entry.name);

    expect(new Set(names).size).toBe(names.length);

    for (const entry of FALLBACK_LICENSE_TEXTS) {
      expect(entry.files.length, entry.name).toBeGreaterThan(0);
      expect(isLicenseAllowed(entry.license, ALLOWED_BUNDLE_LICENSES), entry.name).toBe(true);
    }
  });
});
