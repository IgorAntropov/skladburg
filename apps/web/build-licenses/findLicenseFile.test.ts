import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempWorkspaceValue } from './createTempWorkspace.ts';

import { createTempWorkspace } from './createTempWorkspace.ts';
import { findLicenseText } from './findLicenseFile.ts';

const workspaces: TempWorkspaceValue[] = [];

const createWorkspace = (): TempWorkspaceValue => {
  const workspace = createTempWorkspace();

  workspaces.push(workspace);

  return workspace;
};

describe('findLicenseText', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }
  });

  it('reads and trims the LICENSE file', () => {
    const workspace = createWorkspace();

    workspace.writeFile('pkg/LICENSE', '\n  MIT License\n\nCopyright (c) Acme\n\n');

    expect(findLicenseText(`${workspace.root}/pkg`)).toBe('MIT License\n\nCopyright (c) Acme');
  });

  it('accepts LICENCE, COPYING and extensions in any letter case', () => {
    const workspace = createWorkspace();

    workspace.writeFile('licence/Licence.md', 'british');
    workspace.writeFile('copying/COPYING.txt', 'copying');
    workspace.writeFile('lower/license.txt', 'lower');

    expect(findLicenseText(`${workspace.root}/licence`)).toBe('british');
    expect(findLicenseText(`${workspace.root}/copying`)).toBe('copying');
    expect(findLicenseText(`${workspace.root}/lower`)).toBe('lower');
  });

  it('prefers LICENSE over LICENCE and COPYING, and picks the first name otherwise', () => {
    const workspace = createWorkspace();

    workspace.writeFile('all/COPYING', 'copying');
    workspace.writeFile('all/LICENCE', 'licence');
    workspace.writeFile('all/LICENSE', 'license');
    workspace.writeFile('dual/LICENSE-MIT', 'mit');
    workspace.writeFile('dual/LICENSE-APACHE', 'apache');

    expect(findLicenseText(`${workspace.root}/all`)).toBe('license');
    expect(findLicenseText(`${workspace.root}/dual`)).toBe('apache');
  });

  it('ignores folders named like a license file', () => {
    const workspace = createWorkspace();

    workspace.writeFile('pkg/LICENSES/MIT.txt', 'text');

    expect(findLicenseText(`${workspace.root}/pkg`)).toBeUndefined();
  });

  it('returns nothing without a license file, with an empty one or without the folder', () => {
    const workspace = createWorkspace();

    workspace.writeFile('none/README.md', 'readme');
    workspace.writeFile('empty/LICENSE', '  \n');

    expect(findLicenseText(`${workspace.root}/none`)).toBeUndefined();
    expect(findLicenseText(`${workspace.root}/empty`)).toBeUndefined();
    expect(findLicenseText(`${workspace.root}/missing`)).toBeUndefined();
  });
});
