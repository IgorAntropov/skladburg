import {
  describe,
  expect,
  it,
} from 'vitest';

import { normalizeRepositoryUrl } from './normalizeRepositoryUrl.ts';

describe('normalizeRepositoryUrl', () => {
  it('reads a plain string', () => {
    expect(normalizeRepositoryUrl('https://github.com/theKashey/react-remove-scroll-bar')).toBe(
      'https://github.com/theKashey/react-remove-scroll-bar',
    );
  });

  it('reads the url of an object', () => {
    expect(normalizeRepositoryUrl({ directory: 'packages/cel', type: 'git', url: 'https://github.com/bufbuild/cel-es' })).toBe(
      'https://github.com/bufbuild/cel-es',
    );
  });

  it('strips the git+ prefix and the .git suffix', () => {
    expect(normalizeRepositoryUrl({ url: 'git+https://github.com/pmndrs/react-three-fiber.git' })).toBe(
      'https://github.com/pmndrs/react-three-fiber',
    );
  });

  it('turns the git protocol into https', () => {
    expect(normalizeRepositoryUrl('git://github.com/jaredhanson/passport.git')).toBe('https://github.com/jaredhanson/passport');
  });

  it('turns ssh addresses into https', () => {
    expect(normalizeRepositoryUrl('git@github.com:theKashey/get-nonce')).toBe('https://github.com/theKashey/get-nonce');
    expect(normalizeRepositoryUrl('git@gitlab.com:group/project.git')).toBe('https://gitlab.com/group/project');
    expect(normalizeRepositoryUrl('git+ssh://git@github.com/user/project.git')).toBe('https://github.com/user/project');
    expect(normalizeRepositoryUrl('ssh://git@github.com/user/project')).toBe('https://github.com/user/project');
  });

  it('expands hosted shortcuts', () => {
    expect(normalizeRepositoryUrl('github:user/project')).toBe('https://github.com/user/project');
    expect(normalizeRepositoryUrl('gitlab:user/project')).toBe('https://gitlab.com/user/project');
    expect(normalizeRepositoryUrl('bitbucket:user/project')).toBe('https://bitbucket.org/user/project');
    expect(normalizeRepositoryUrl('user/project')).toBe('https://github.com/user/project');
  });

  it('returns nothing for a missing or empty value', () => {
    expect(normalizeRepositoryUrl(undefined)).toBeUndefined();
    expect(normalizeRepositoryUrl('')).toBeUndefined();
    expect(normalizeRepositoryUrl('   ')).toBeUndefined();
    expect(normalizeRepositoryUrl({ type: 'git' })).toBeUndefined();
    expect(normalizeRepositoryUrl({ url: 42 })).toBeUndefined();
    expect(normalizeRepositoryUrl(null)).toBeUndefined();
  });
});
