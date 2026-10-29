import { DEV_APP_VERSION } from './appVersionPaths.ts';

const SHORT_HASH_PATTERN = /^[0-9a-f]{7,40}$/;

export interface ResolveAppVersionOptionsValue {
  readGitHead: () => string;
}

export const resolveAppVersion = ({ readGitHead }: ResolveAppVersionOptionsValue): string => {
  try {
    const hash = readGitHead().trim().toLowerCase();

    return SHORT_HASH_PATTERN.test(hash) ? hash : DEV_APP_VERSION;
  }
  catch {
    return DEV_APP_VERSION;
  }
};
