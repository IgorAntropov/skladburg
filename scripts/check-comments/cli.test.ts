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
} from '../testing/temp-repository.ts';

describe('check-comments CLI', () => {
  let repositoryDirectory = '';

  beforeEach(() => {
    repositoryDirectory = createTempRepository();
  });

  afterEach(() => {
    removeTempRepository(repositoryDirectory);
  });

  describe('with file arguments', () => {
    it('exits with code 0 and prints nothing for a file without comments', () => {
      writeRepositoryFile(repositoryDirectory, 'clean.css', 'a { color: red; }\n');

      const result = runCheckCommentsCli(repositoryDirectory, ['clean.css']);

      expect(result).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });

    it('prints the path, the line and the kind of every finding and exits with code 1', () => {
      writeRepositoryFile(repositoryDirectory, 'dirty.css', 'a {}\n/* x */\nb {}\n/* y */\n');

      const result = runCheckCommentsCli(repositoryDirectory, ['dirty.css']);

      expect(result).toEqual({
        exitCode: 1,
        stderr: 'dirty.css:2: comment found (css)\ndirty.css:4: comment found (css)\n',
        stdout: '',
      });
    });

    it('reports a comment inside a style element of an html file with its absolute line number', () => {
      writeRepositoryFile(repositoryDirectory, 'index.html', '<html>\n<style>\n/* x */\n</style>\n</html>\n');

      const result = runCheckCommentsCli(repositoryDirectory, ['index.html']);

      expect(result.stderr).toBe('index.html:3: comment found (html)\n');
      expect(result.exitCode).toBe(1);
    });

    it('reports a comment inside a script element of an svg file', () => {
      writeRepositoryFile(repositoryDirectory, 'logo.svg', '<svg>\n<script>\n// x\n</script>\n</svg>\n');

      const result = runCheckCommentsCli(repositoryDirectory, ['logo.svg']);

      expect(result.stderr).toBe('logo.svg:3: comment found (svg)\n');
      expect(result.exitCode).toBe(1);
    });

    it('does not report text inside a yaml block scalar', () => {
      writeRepositoryFile(repositoryDirectory, 'workflow.yml', 'run: |\n  echo 1 # not a comment\nnext: 1\n');

      expect(runCheckCommentsCli(repositoryDirectory, ['workflow.yml']).exitCode).toBe(0);
    });

    it('reports a comment on the indicator line of a yaml block scalar', () => {
      writeRepositoryFile(repositoryDirectory, 'workflow.yml', 'run: | # x\n  echo 1\n');

      const result = runCheckCommentsCli(repositoryDirectory, ['workflow.yml']);

      expect(result.stderr).toBe('workflow.yml:1: comment found (yaml)\n');
      expect(result.exitCode).toBe(1);
    });

    it.each([
      ['styles.scss', '/* x */\n', 'css'],
      ['.env.example', '# x\n', 'hash-line'],
      ['.env', '# x\n', 'hash-line'],
      ['.npmrc', '; x\n', 'hash-or-semicolon-line'],
      ['api.proto', '// x\n', 'proto'],
    ])('exits with code 1 for a comment in %s', (fileName, content, expectedKind) => {
      writeRepositoryFile(repositoryDirectory, fileName, content);

      const result = runCheckCommentsCli(repositoryDirectory, [fileName]);

      expect(result.stderr).toBe(`${fileName}:1: comment found (${expectedKind})\n`);
      expect(result.exitCode).toBe(1);
    });

    it('exits with code 1 and names a file that does not exist', () => {
      const result = runCheckCommentsCli(repositoryDirectory, ['missing.css']);

      expect(result).toEqual({ exitCode: 1, stderr: 'missing.css: file not found\n', stdout: '' });
    });

    it('keeps checking the remaining files after a missing one', () => {
      writeRepositoryFile(repositoryDirectory, 'dirty.css', '/* x */\n');

      const result = runCheckCommentsCli(repositoryDirectory, ['missing.css', 'dirty.css']);

      expect(result.stderr).toBe('missing.css: file not found\ndirty.css:1: comment found (css)\n');
      expect(result.exitCode).toBe(1);
    });

    it('checks files whose path contains Cyrillic letters and a space', () => {
      writeRepositoryFile(repositoryDirectory, 'папка с пробелом/стили.css', '/* x */\n');

      const result = runCheckCommentsCli(repositoryDirectory, ['папка с пробелом/стили.css']);

      expect(result.stderr).toBe('папка с пробелом/стили.css:1: comment found (css)\n');
      expect(result.exitCode).toBe(1);
    });

    it.each([
      ['notes.md', '# heading\n<!-- x -->\n'],
      ['main.ts', '// x\n'],
      ['view.tsx', '/* x */\n'],
      ['script.js', '// x\n'],
      ['pnpm-lock.yaml', '# x\n'],
      ['notes.txt', '# x\n'],
    ])('skips %s even when it is passed explicitly', (fileName, content) => {
      writeRepositoryFile(repositoryDirectory, fileName, content);

      const result = runCheckCommentsCli(repositoryDirectory, [fileName]);

      expect(result).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });

    it('checks only the passed files and does not scan the repository', () => {
      writeRepositoryFile(repositoryDirectory, 'dirty.css', '/* x */\n');
      writeRepositoryFile(repositoryDirectory, 'clean.css', 'a {}\n');

      expect(runCheckCommentsCli(repositoryDirectory, ['clean.css']).exitCode).toBe(0);
    });
  });

  describe('without arguments', () => {
    it('exits with code 0 for an empty repository', () => {
      expect(runCheckCommentsCli(repositoryDirectory, [])).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });

    it('checks an untracked file that is not ignored', () => {
      writeRepositoryFile(repositoryDirectory, 'dirty.css', '/* x */\n');

      const result = runCheckCommentsCli(repositoryDirectory, []);

      expect(result.stderr).toBe('dirty.css:1: comment found (css)\n');
      expect(result.exitCode).toBe(1);
    });

    it('checks an indexed file', () => {
      writeRepositoryFile(repositoryDirectory, 'dirty.css', '/* x */\n');
      runGitInRepository(repositoryDirectory, ['add', 'dirty.css']);

      expect(runCheckCommentsCli(repositoryDirectory, []).stderr).toBe('dirty.css:1: comment found (css)\n');
    });

    it('checks files whose path contains Cyrillic letters and a space', () => {
      writeRepositoryFile(repositoryDirectory, 'apps/Мой пакет/стили.css', '/* x */\n');
      writeRepositoryFile(repositoryDirectory, 'packages/общий код/данные.json', '{ // x\n}\n');
      runGitInRepository(repositoryDirectory, ['add', 'apps']);

      const result = runCheckCommentsCli(repositoryDirectory, []);

      expect(result.stderr).toContain('apps/Мой пакет/стили.css:1: comment found (css)\n');
      expect(result.stderr).toContain('packages/общий код/данные.json:1: comment found (json)\n');
      expect(result.exitCode).toBe(1);
    });

    it('skips a file that is ignored by git', () => {
      writeRepositoryFile(repositoryDirectory, '.gitignore', 'ignored.css\n');
      writeRepositoryFile(repositoryDirectory, 'ignored.css', '/* x */\n');

      expect(runCheckCommentsCli(repositoryDirectory, [])).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });

    it('skips a file that is indexed but deleted from the working tree', () => {
      writeRepositoryFile(repositoryDirectory, 'removed.css', '/* x */\n');
      runGitInRepository(repositoryDirectory, ['add', 'removed.css']);
      removeRepositoryFile(repositoryDirectory, 'removed.css');

      expect(runCheckCommentsCli(repositoryDirectory, [])).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });

    it.each([
      ['notes.md', '# heading\n'],
      ['main.ts', '// x\n'],
      ['view.tsx', '/* x */\n'],
      ['script.js', '// x\n'],
      ['pnpm-lock.yaml', '# x\n'],
      ['apps/web/pnpm-lock.yaml', '# x\n'],
      ['apps/web/README.md', '# heading\n'],
      ['scripts/tool.ts', '// x\n'],
    ])('skips %s', (relativePath, content) => {
      writeRepositoryFile(repositoryDirectory, relativePath, content);

      expect(runCheckCommentsCli(repositoryDirectory, [])).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });

    it.each([
      ['a file in the repository root', 'root.css', '/* x */\n'],
      ['a dot file in the repository root', '.nvmrc', '# x\n'],
      ['a file in apps', 'apps/web/index.html', '<!-- x -->\n'],
      ['a file in packages', 'packages/contracts/api.proto', '// x\n'],
      ['a file in scripts', 'scripts/config.json', '{ // x\n}\n'],
    ])('checks %s', (_name, relativePath, content) => {
      writeRepositoryFile(repositoryDirectory, relativePath, content);

      const result = runCheckCommentsCli(repositoryDirectory, []);

      expect(result.stderr).toContain(`${relativePath}:1: comment found (`);
      expect(result.exitCode).toBe(1);
    });

    it('does not check a file in a nested directory outside apps, packages and scripts', () => {
      writeRepositoryFile(repositoryDirectory, 'docs/guide.css', '/* x */\n');

      expect(runCheckCommentsCli(repositoryDirectory, [])).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });

    it('does not report anything when every checked file is clean', () => {
      writeRepositoryFile(repositoryDirectory, 'a.css', 'a {}\n');
      writeRepositoryFile(repositoryDirectory, 'apps/web/index.html', '<html></html>\n');
      writeRepositoryFile(repositoryDirectory, 'b.yaml', 'a: 1\n');
      runGitInRepository(repositoryDirectory, ['add', '.']);

      expect(runCheckCommentsCli(repositoryDirectory, [])).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    });
  });
});
