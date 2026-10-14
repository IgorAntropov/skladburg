import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempWorkspaceValue } from './createTempWorkspace.ts';

import { createTempWorkspace } from './createTempWorkspace.ts';
import { readPackageManifest } from './readPackageManifest.ts';

const workspaces: TempWorkspaceValue[] = [];

const createWorkspace = (): TempWorkspaceValue => {
  const workspace = createTempWorkspace();

  workspaces.push(workspace);

  return workspace;
};

describe('readPackageManifest', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }
  });

  it('reads name, version, license and repository', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('pkg', {
      license: 'MIT',
      name: 'pkg',
      repository: { url: 'git+https://github.com/acme/pkg.git' },
      version: '1.2.3',
    });

    expect(readPackageManifest(root)).toEqual({
      license: 'MIT',
      name: 'pkg',
      repository: 'https://github.com/acme/pkg',
      version: '1.2.3',
    });
  });

  it('reads the legacy license object', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('pkg', { license: { type: 'MIT', url: 'https://example.test' }, name: 'pkg', version: '1.0.0' });

    expect(readPackageManifest(root)?.license).toBe('MIT');
  });

  it('leaves the license empty when the field is absent or blank', () => {
    const workspace = createWorkspace();
    const absent = workspace.writePackage('absent', { name: 'absent', version: '1.0.0' });
    const blank = workspace.writePackage('blank', { license: '  ', name: 'blank', version: '1.0.0' });
    const wrongType = workspace.writePackage('wrong', { license: 7, name: 'wrong', version: '1.0.0' });

    expect(readPackageManifest(absent)?.license).toBeUndefined();
    expect(readPackageManifest(blank)?.license).toBeUndefined();
    expect(readPackageManifest(wrongType)?.license).toBeUndefined();
  });

  it('falls back to the zero version when it is missing', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('pkg', { license: 'MIT', name: 'pkg' });

    expect(readPackageManifest(root)?.version).toBe('0.0.0');
  });

  it('returns nothing when the manifest has no name, is broken or does not exist', () => {
    const workspace = createWorkspace();
    const nameless = workspace.writePackage('nameless', { type: 'module' });
    const broken = workspace.writeFile('broken/package.json', '{ not json');
    const array = workspace.writeFile('array/package.json', '[]');

    expect(readPackageManifest(nameless)).toBeUndefined();
    expect(readPackageManifest(broken.replace('/package.json', ''))).toBeUndefined();
    expect(readPackageManifest(array.replace('/package.json', ''))).toBeUndefined();
    expect(readPackageManifest(`${workspace.root}/missing`)).toBeUndefined();
  });
});
