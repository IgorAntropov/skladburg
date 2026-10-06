import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  join,
  relative,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  createTempRepository,
  removeRepositoryFile,
  removeTempRepository,
  runCheckCommentsCli,
  runGitInRepository,
  writeRepositoryFile,
} from './temp-repository.ts';

const projectDirectory = fileURLToPath(new URL('../..', import.meta.url));
const outsideMessage = 'Refusing to run outside of the temporary directory';
const escapeMessage = 'Refusing to touch a path outside of the repository directory';
const gitProbeArguments = ['rev-parse', '--show-toplevel'];
const foreignMarkerName = 'marker.txt';
const foreignMarkerContent = 'foreign-marker';

describe('temporary repository helpers', () => {
  let decoyDirectory = '';
  let foreignDirectory = '';
  let repositoryDirectory = '';

  const expectForeignDirectoryIntact = (): void => {
    expect(readdirSync(foreignDirectory)).toEqual([foreignMarkerName]);
    expect(readFileSync(join(foreignDirectory, foreignMarkerName), 'utf8')).toBe(foreignMarkerContent);
  };

  beforeEach(() => {
    foreignDirectory = realpathSync(mkdtempSync(join(tmpdir(), 'skladburg-foreign-')));
    writeFileSync(join(foreignDirectory, foreignMarkerName), foreignMarkerContent);
    decoyDirectory = realpathSync(mkdtempSync(join(tmpdir(), 'skladburg-tool-tests-decoy-')));
    process.env.GIT_INDEX_FILE = join(decoyDirectory, 'decoy-index');
    process.env.GIT_DIR = join(decoyDirectory, 'decoy-git-dir');
    repositoryDirectory = createTempRepository();
  });

  afterEach(() => {
    removeTempRepository(repositoryDirectory);
    Reflect.deleteProperty(process.env, 'GIT_INDEX_FILE');
    Reflect.deleteProperty(process.env, 'GIT_DIR');
    rmSync(decoyDirectory, { force: true, recursive: true });
    rmSync(foreignDirectory, { force: true, recursive: true });
  });

  it('creates a repository inside the temporary directory even when GIT_DIR is set in the current process', () => {
    expect(existsSync(join(repositoryDirectory, '.git'))).toBe(true);
    expect(existsSync(process.env.GIT_DIR ?? '')).toBe(false);
  });

  it('does not touch the index from the current environment when git adds files', () => {
    writeRepositoryFile(repositoryDirectory, 'a.css', 'a {}\n');

    runGitInRepository(repositoryDirectory, ['add', 'a.css']);

    expect(existsSync(process.env.GIT_INDEX_FILE ?? '')).toBe(false);
    expect(runGitInRepository(repositoryDirectory, ['ls-files'])).toBe('a.css\n');
  });

  it('runs the CLI against the temporary repository even when GIT_INDEX_FILE is set in the current process', () => {
    writeRepositoryFile(repositoryDirectory, 'a.css', '/* x */\n');
    runGitInRepository(repositoryDirectory, ['add', 'a.css']);

    const result = runCheckCommentsCli(repositoryDirectory, []);

    expect(result.stderr).toBe('a.css:1: comment found (css)\n');
    expect(existsSync(process.env.GIT_INDEX_FILE ?? '')).toBe(false);
  });

  it('removes the repository directory', () => {
    const extraDirectory = createTempRepository();

    removeTempRepository(extraDirectory);

    expect(existsSync(extraDirectory)).toBe(false);
  });

  it('refuses to run tools in the project directory', () => {
    expect(() => runGitInRepository(projectDirectory, gitProbeArguments)).toThrow(outsideMessage);
    expect(() => runCheckCommentsCli(projectDirectory, [])).toThrow(outsideMessage);
  });

  it('refuses a path with parent segments that leads to the project directory', () => {
    const traversal = `${repositoryDirectory}${sep}${relative(repositoryDirectory, projectDirectory)}`;

    expect(traversal).toContain(`..${sep}`);
    expect(() => runGitInRepository(traversal, gitProbeArguments)).toThrow(outsideMessage);
    expect(() => runCheckCommentsCli(traversal, [])).toThrow(outsideMessage);
  });

  it('refuses a path with parent segments that leads to a foreign directory', () => {
    const traversal = `${repositoryDirectory}${sep}${relative(repositoryDirectory, foreignDirectory)}`;

    expect(traversal).toContain(`..${sep}`);
    expect(() => runGitInRepository(traversal, gitProbeArguments)).toThrow(outsideMessage);
    expect(() => runCheckCommentsCli(traversal, [])).toThrow(outsideMessage);
    expect(() => {
      removeTempRepository(traversal);
    }).toThrow(outsideMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses a foreign directory inside the temporary directory', () => {
    expect(() => runGitInRepository(foreignDirectory, gitProbeArguments)).toThrow(outsideMessage);
    expect(() => runCheckCommentsCli(foreignDirectory, [])).toThrow(outsideMessage);
    expect(() => {
      removeTempRepository(foreignDirectory);
    }).toThrow(outsideMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses the temporary directory itself', () => {
    expect(() => runGitInRepository(tmpdir(), gitProbeArguments)).toThrow(outsideMessage);
    expect(() => runCheckCommentsCli(tmpdir(), [])).toThrow(outsideMessage);
  });

  it('refuses a symbolic link inside the temporary directory that points at the project', () => {
    const linkPath = join(decoyDirectory, 'link-to-project');

    symlinkSync(projectDirectory, linkPath);

    expect(() => runGitInRepository(linkPath, gitProbeArguments)).toThrow(outsideMessage);
    expect(() => runCheckCommentsCli(linkPath, [])).toThrow(outsideMessage);
  });

  it('refuses to remove a symbolic link inside the owned directory that points at a foreign directory', () => {
    const linkPath = join(decoyDirectory, 'link-to-foreign');

    symlinkSync(foreignDirectory, linkPath);

    expect(() => {
      removeTempRepository(linkPath);
    }).toThrow(outsideMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses to remove a nested directory of a temporary repository', () => {
    writeRepositoryFile(repositoryDirectory, 'nested/a.txt', 'x');

    expect(() => {
      removeTempRepository(join(repositoryDirectory, 'nested'));
    }).toThrow('Refusing to remove anything but a temporary repository');
    expect(existsSync(join(repositoryDirectory, 'nested', 'a.txt'))).toBe(true);
  });

  it('refuses to write a file into a directory that is not an owned temporary repository', () => {
    expect(() => {
      writeRepositoryFile(foreignDirectory, 'should-not-exist.txt', 'x');
    }).toThrow(outsideMessage);
    expect(() => {
      removeRepositoryFile(foreignDirectory, foreignMarkerName);
    }).toThrow(outsideMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses a relative path that leaves the repository directory', () => {
    const escapingNewFile = relative(repositoryDirectory, join(foreignDirectory, 'should-not-exist.txt'));
    const escapingMarker = relative(repositoryDirectory, join(foreignDirectory, foreignMarkerName));

    expect(escapingNewFile).toContain(`..${sep}`);
    expect(() => {
      writeRepositoryFile(repositoryDirectory, escapingNewFile, 'x');
    }).toThrow(escapeMessage);
    expect(() => {
      writeRepositoryFile(repositoryDirectory, escapingMarker, 'overwritten');
    }).toThrow(escapeMessage);
    expect(() => {
      removeRepositoryFile(repositoryDirectory, escapingMarker);
    }).toThrow(escapeMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses an absolute relative path', () => {
    expect(() => {
      writeRepositoryFile(repositoryDirectory, join(foreignDirectory, 'should-not-exist.txt'), 'x');
    }).toThrow(escapeMessage);
    expect(() => {
      writeRepositoryFile(repositoryDirectory, join(foreignDirectory, foreignMarkerName), 'overwritten');
    }).toThrow(escapeMessage);
    expect(() => {
      removeRepositoryFile(repositoryDirectory, join(foreignDirectory, foreignMarkerName));
    }).toThrow(escapeMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses a relative path that goes through a symbolic link to a foreign directory', () => {
    symlinkSync(foreignDirectory, join(repositoryDirectory, 'link-to-foreign'));

    expect(() => {
      writeRepositoryFile(repositoryDirectory, 'link-to-foreign/should-not-exist.txt', 'x');
    }).toThrow(escapeMessage);
    expect(() => {
      writeRepositoryFile(repositoryDirectory, `link-to-foreign/${foreignMarkerName}`, 'overwritten');
    }).toThrow(escapeMessage);
    expect(() => {
      removeRepositoryFile(repositoryDirectory, `link-to-foreign/${foreignMarkerName}`);
    }).toThrow(escapeMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses a symbolic link to a foreign file', () => {
    symlinkSync(join(foreignDirectory, foreignMarkerName), join(repositoryDirectory, 'link-to-marker.txt'));

    expect(() => {
      writeRepositoryFile(repositoryDirectory, 'link-to-marker.txt', 'overwritten');
    }).toThrow(escapeMessage);
    expect(() => {
      removeRepositoryFile(repositoryDirectory, 'link-to-marker.txt');
    }).toThrow(escapeMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses a dangling symbolic link whose target is a missing file inside a foreign directory', () => {
    symlinkSync(join(foreignDirectory, 'created.txt'), join(repositoryDirectory, 'dangling.txt'));

    expect(() => {
      writeRepositoryFile(repositoryDirectory, 'dangling.txt', 'x');
    }).toThrow(escapeMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses a dangling symbolic link whose target is a missing directory inside a foreign directory', () => {
    symlinkSync(join(foreignDirectory, 'missing-directory'), join(repositoryDirectory, 'dangling-directory'));

    expect(() => {
      writeRepositoryFile(repositoryDirectory, 'dangling-directory/a.txt', 'x');
    }).toThrow(escapeMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses a chain of symbolic links that ends in a foreign directory', () => {
    symlinkSync(foreignDirectory, join(repositoryDirectory, 'second-link'));
    symlinkSync('second-link', join(repositoryDirectory, 'first-link'));

    expect(() => {
      writeRepositoryFile(repositoryDirectory, 'first-link/should-not-exist.txt', 'x');
    }).toThrow(escapeMessage);
    expectForeignDirectoryIntact();
  });

  it('refuses cyclic symbolic links', () => {
    symlinkSync('second-loop', join(repositoryDirectory, 'first-loop'));
    symlinkSync('first-loop', join(repositoryDirectory, 'second-loop'));

    expect(() => {
      writeRepositoryFile(repositoryDirectory, 'first-loop/a.txt', 'x');
    }).toThrow('Refusing to follow a cyclic symbolic link');
  });

  it('writes through a symbolic link that stays inside the repository directory', () => {
    symlinkSync('target.txt', join(repositoryDirectory, 'alias.txt'));

    writeRepositoryFile(repositoryDirectory, 'alias.txt', 'x');

    expect(readFileSync(join(repositoryDirectory, 'target.txt'), 'utf8')).toBe('x');
  });

  it('removes a file inside the repository directory', () => {
    writeRepositoryFile(repositoryDirectory, 'dir/a.txt', 'x');

    removeRepositoryFile(repositoryDirectory, 'dir/a.txt');

    expect(existsSync(join(repositoryDirectory, 'dir', 'a.txt'))).toBe(false);
  });
});
