import { execFileSync } from 'node:child_process';

const GIT_TIMEOUT_MS = 5000;

export const createGitHeadReader = (cwd: string): (() => string) => (): string => execFileSync(
  'git',
  ['rev-parse', '--short=7', 'HEAD'],
  { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_TIMEOUT_MS },
);
