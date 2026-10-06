import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export const listRepositoryFiles = (): string[] =>
  execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'apps', 'packages', 'scripts', ':(glob)*'],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter(filePath => filePath !== '' && existsSync(filePath));
