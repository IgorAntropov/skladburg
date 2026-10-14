import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

const LICENSE_FILE_PATTERNS = [/^license/i, /^licence/i, /^copying/i];

interface LicenseFileCandidateValue {
  name: string;
  patternIndex: number;
}

const isRegularFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  }
  catch {
    return false;
  }
};

const compareCandidates = (current: LicenseFileCandidateValue, prev: LicenseFileCandidateValue): number => {
  if (current.patternIndex !== prev.patternIndex) {
    return current.patternIndex - prev.patternIndex;
  }

  if (current.name === prev.name) {
    return 0;
  }

  return current.name < prev.name ? -1 : 1;
};

const toCandidate = (name: string): LicenseFileCandidateValue[] => {
  const patternIndex = LICENSE_FILE_PATTERNS.findIndex(pattern => pattern.test(name));

  return patternIndex === -1 ? [] : [{ name, patternIndex }];
};

export const findLicenseText = (packageRoot: string): string | undefined => {
  let names: string[];

  try {
    names = readdirSync(packageRoot);
  }
  catch {
    return undefined;
  }

  const [candidate] = names
    .flatMap(toCandidate)
    .filter(item => isRegularFile(join(packageRoot, item.name)))
    .toSorted(compareCandidates);

  if (candidate === undefined) {
    return undefined;
  }

  const text = readFileSync(join(packageRoot, candidate.name), 'utf-8').trim();

  return text === '' ? undefined : text;
};
