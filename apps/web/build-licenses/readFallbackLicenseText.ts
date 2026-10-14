import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FallbackLicenseTextValue } from './licenseTypes.ts';

export type FallbackLicenseTextLookupValue
  = | { reason: string; status: 'rejected' }
    | { status: 'absent' }
    | { status: 'found'; text: string };

export interface ReadFallbackLicenseTextOptionsValue {
  directory: string;
  fallbackTexts: readonly FallbackLicenseTextValue[];
  license: string;
  name: string;
}

const TEXT_SEPARATOR = '\n\n';

const readFileText = (path: string): string | undefined => {
  try {
    const text = readFileSync(path, 'utf-8').trim();

    return text === '' ? undefined : text;
  }
  catch {
    return undefined;
  }
};

export const readFallbackLicenseText = ({
  directory,
  fallbackTexts,
  license,
  name,
}: ReadFallbackLicenseTextOptionsValue): FallbackLicenseTextLookupValue => {
  const entry = fallbackTexts.find(item => item.name === name);

  if (entry === undefined) {
    return { status: 'absent' };
  }

  if (entry.license !== license) {
    return {
      reason: `has no license file and its fallback text is recorded for license "${entry.license}", but package.json says "${license}"`,
      status: 'rejected',
    };
  }

  const texts: string[] = [];

  for (const file of entry.files) {
    const text = readFileText(join(directory, file));

    if (text === undefined) {
      return { reason: `has no license file and its fallback text file "${file}" is missing or empty`, status: 'rejected' };
    }

    texts.push(text);
  }

  return { status: 'found', text: texts.join(TEXT_SEPARATOR) };
};
