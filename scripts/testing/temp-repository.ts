import {
  execFileSync,
  spawnSync,
} from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCleanEnvironment } from './clean-environment.ts';

export interface CliResultValue {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const checkCommentsCliPath = fileURLToPath(new URL('../check-comments.ts', import.meta.url));
const temporaryRoot = realpathSync(tmpdir());
const directoryPrefix = 'skladburg-tool-tests-';

const resolveRealPath = (path: string): string => {
  const absolutePath = resolve(path);

  if (existsSync(absolutePath)) {
    return realpathSync(absolutePath);
  }

  return join(resolveRealPath(dirname(absolutePath)), basename(absolutePath));
};

const isInside = (parent: string, child: string): boolean => {
  const relativePath = relative(parent, child);

  return relativePath !== ''
    && relativePath !== '..'
    && !relativePath.startsWith(`..${sep}`)
    && !isAbsolute(relativePath);
};

const getOwnedRoot = (directory: string): string | undefined => {
  const realDirectory = resolveRealPath(directory);

  if (!isInside(temporaryRoot, realDirectory)) {
    return undefined;
  }

  const [firstSegment = ''] = relative(temporaryRoot, realDirectory).split(sep);

  return firstSegment.startsWith(directoryPrefix) ? join(temporaryRoot, firstSegment) : undefined;
};

const assertInsideTemporaryRoot = (directory: string): string => {
  const realDirectory = resolveRealPath(directory);

  if (getOwnedRoot(realDirectory) === undefined) {
    throw new Error(`Refusing to run outside of the temporary directory: ${directory}`);
  }

  return realDirectory;
};

const assertLinksStayInside = (
  repositoryDirectory: string,
  path: string,
  visitedLinks: Set<string>,
): void => {
  const segments = relative(repositoryDirectory, path).split(sep);
  let currentPath = repositoryDirectory;

  for (const segment of segments) {
    currentPath = join(currentPath, segment);

    const stats = lstatSync(currentPath, { throwIfNoEntry: false });

    if (stats === undefined) {
      return;
    }

    if (!stats.isSymbolicLink()) {
      continue;
    }

    if (visitedLinks.has(currentPath)) {
      throw new Error(`Refusing to follow a cyclic symbolic link: ${currentPath}`);
    }

    visitedLinks.add(currentPath);

    const linkTarget = resolve(dirname(currentPath), readlinkSync(currentPath));

    if (linkTarget !== repositoryDirectory && !isInside(repositoryDirectory, linkTarget)) {
      throw new Error(`Refusing to touch a path outside of the repository directory: ${currentPath}`);
    }

    assertLinksStayInside(repositoryDirectory, linkTarget, visitedLinks);
  }
};

const resolveInsideRepository = (directory: string, relativePath: string): string => {
  const realDirectory = assertInsideTemporaryRoot(directory);
  const lexicalTarget = resolve(realDirectory, relativePath);
  const target = resolveRealPath(lexicalTarget);

  if (!isInside(realDirectory, target) || !isInside(realDirectory, lexicalTarget)) {
    throw new Error(`Refusing to touch a path outside of the repository directory: ${relativePath}`);
  }

  assertLinksStayInside(realDirectory, lexicalTarget, new Set());

  return target;
};

export const runGitInRepository = (directory: string, args: string[]): string => {
  const realDirectory = assertInsideTemporaryRoot(directory);

  return execFileSync('git', args, {
    cwd: realDirectory,
    encoding: 'utf8',
    env: createCleanEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

export const createTempRepository = (): string => {
  const directory = realpathSync(mkdtempSync(join(temporaryRoot, directoryPrefix)));

  runGitInRepository(directory, ['init', '--quiet']);

  return directory;
};

export const removeTempRepository = (directory: string): void => {
  const realDirectory = assertInsideTemporaryRoot(directory);

  if (realDirectory !== getOwnedRoot(realDirectory)) {
    throw new Error(`Refusing to remove anything but a temporary repository: ${directory}`);
  }

  rmSync(realDirectory, { force: true, recursive: true });
};

export const writeRepositoryFile = (directory: string, relativePath: string, content: string): void => {
  const filePath = resolveInsideRepository(directory, relativePath);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

export const removeRepositoryFile = (directory: string, relativePath: string): void => {
  rmSync(resolveInsideRepository(directory, relativePath), { force: true });
};

export const runCheckCommentsCli = (directory: string, args: string[]): CliResultValue => {
  const realDirectory = assertInsideTemporaryRoot(directory);

  const result = spawnSync(process.execPath, [checkCommentsCliPath, ...args], {
    cwd: realDirectory,
    encoding: 'utf8',
    env: createCleanEnvironment(),
  });

  return { exitCode: result.status ?? -1, stderr: result.stderr, stdout: result.stdout };
};
