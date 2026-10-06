import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { BuildProfileValue } from './buildProfileTypes.ts';

import {
  CATALOGS_DIRECTORY,
  PROFILES_DIRECTORY,
} from './buildProfilePaths.ts';
import { parseBuildProfile } from './parseBuildProfile.ts';

const PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const JSON_EXTENSION = '.json';

export interface LoadBuildProfileOptionsValue {
  appRoot: string;
  profileName: string;
}

const listAvailableProfiles = (profilesDirectory: string): string[] => {
  if (!existsSync(profilesDirectory)) {
    return [];
  }

  return readdirSync(profilesDirectory)
    .filter(fileName => fileName.endsWith(JSON_EXTENSION))
    .map(fileName => fileName.slice(0, -JSON_EXTENSION.length))
    .sort();
};

const readProfileJson = (profilePath: string, profileName: string): unknown => {
  const text = readFileSync(profilePath, 'utf8');

  try {
    const parsed: unknown = JSON.parse(text);

    return parsed;
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(`Build profile "${profileName}": ${profilePath} is not valid JSON (${reason})`, { cause: error });
  }
};

export const loadBuildProfile = ({ appRoot, profileName }: LoadBuildProfileOptionsValue): BuildProfileValue => {
  const profilesDirectory = join(appRoot, PROFILES_DIRECTORY);

  if (!PROFILE_NAME_PATTERN.test(profileName)) {
    throw new Error(`Build profile name "${profileName}" is invalid: use letters, digits, "-" and "_"`);
  }

  const profilePath = join(profilesDirectory, `${profileName}${JSON_EXTENSION}`);

  if (!existsSync(profilePath)) {
    const available = listAvailableProfiles(profilesDirectory);
    const availableText = available.length > 0 ? available.join(', ') : 'none';

    throw new Error(`Build profile "${profileName}" not found at ${profilePath}. Available profiles: ${availableText}`);
  }

  const profile = parseBuildProfile(readProfileJson(profilePath, profileName), profileName);

  const catalogsDirectory = join(appRoot, CATALOGS_DIRECTORY);
  const catalogFileNames = existsSync(catalogsDirectory) ? readdirSync(catalogsDirectory) : [];

  for (const locale of profile.bundledLocales) {
    const catalogFileName = `${locale}.ts`;

    if (!catalogFileNames.includes(catalogFileName)) {
      const catalogPath = join(catalogsDirectory, catalogFileName);

      throw new Error(
        `Build profile "${profileName}": catalog for locale "${locale}" not found at ${catalogPath} (file names are case-sensitive)`,
      );
    }
  }

  return profile;
};
