import { join } from 'node:path';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempWorkspaceValue } from './createTempWorkspace.ts';

import { createTempWorkspace } from './createTempWorkspace.ts';
import { findPackageRoot } from './findPackageRoot.ts';

const workspaces: TempWorkspaceValue[] = [];

const createWorkspace = (): TempWorkspaceValue => {
  const workspace = createTempWorkspace();

  workspaces.push(workspace);

  return workspace;
};

describe('findPackageRoot', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }
  });

  it('finds the root of a plain package', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('node_modules/react', { name: 'react', version: '19.0.0' });
    const moduleId = workspace.writeFile('node_modules/react/cjs/react.production.js', '');

    expect(findPackageRoot(moduleId, new Map())).toBe(root);
  });

  it('finds the root of a scoped package in the pnpm layout', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('node_modules/.pnpm/@radix-ui+react-slot@1.4.0_react@19.0.0/node_modules/@radix-ui/react-slot', {
      name: '@radix-ui/react-slot',
      version: '1.4.0',
    });
    const moduleId = join(root, 'dist', 'index.mjs');

    expect(findPackageRoot(moduleId, new Map())).toBe(root);
  });

  it('skips a nested package.json without a name', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('node_modules/.pnpm/idb@8.0.4/node_modules/idb', { name: 'idb', version: '8.0.4' });

    workspace.writeFile('node_modules/.pnpm/idb@8.0.4/node_modules/idb/build/package.json', '{"type":"module"}');

    const moduleId = workspace.writeFile('node_modules/.pnpm/idb@8.0.4/node_modules/idb/build/index.js', '');

    expect(findPackageRoot(moduleId, new Map())).toBe(root);
  });

  it('stops at the node_modules folder and ignores the manifest of the project above it', () => {
    const workspace = createWorkspace();

    workspace.writePackage('', { name: 'project', version: '1.0.0' });

    const moduleId = workspace.writeFile('node_modules/orphan/index.js', '');

    expect(findPackageRoot(moduleId, new Map())).toBeUndefined();
  });

  it('ignores virtual modules', () => {
    const workspace = createWorkspace();

    workspace.writePackage('node_modules/zustand', { name: 'zustand', version: '5.0.0' });

    const moduleId = workspace.writeFile('node_modules/zustand/index.js', '');

    expect(findPackageRoot(`\0${moduleId}`, new Map())).toBeUndefined();
    expect(findPackageRoot('\0vite/preload-helper.js', new Map())).toBeUndefined();
  });

  it('ignores modules outside node_modules', () => {
    const workspace = createWorkspace();

    workspace.writePackage('packages/contracts', { name: '@skladburg/contracts', version: '0.0.0' });

    const moduleId = workspace.writeFile('packages/contracts/index.ts', '');

    expect(findPackageRoot(moduleId, new Map())).toBeUndefined();
  });

  it('ignores a query on the module id', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('node_modules/three', { name: 'three', version: '0.186.0' });
    const moduleId = workspace.writeFile('node_modules/three/build/three.module.js', '');

    expect(findPackageRoot(`${moduleId}?v=abc`, new Map())).toBe(root);
  });

  it('reuses the cache between modules of one package', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('node_modules/zustand', { name: 'zustand', version: '5.0.0' });
    const cache = new Map<string, string | undefined>();

    findPackageRoot(join(root, 'esm', 'index.mjs'), cache);

    expect(cache.get(join(root, 'esm'))).toBe(root);
    expect(findPackageRoot(join(root, 'esm', 'vanilla.mjs'), cache)).toBe(root);
  });
});
