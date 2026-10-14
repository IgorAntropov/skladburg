import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempWorkspaceValue } from './createTempWorkspace.ts';

import { createTempWorkspace } from './createTempWorkspace.ts';
import { resolvePackageRoot } from './resolvePackageRoot.ts';

const workspaces: TempWorkspaceValue[] = [];

const createWorkspace = (): TempWorkspaceValue => {
  const workspace = createTempWorkspace();

  workspaces.push(workspace);

  return workspace;
};

describe('resolvePackageRoot', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }
  });

  it('resolves a package from the app root', () => {
    const workspace = createWorkspace();
    const root = workspace.writePackage('app/node_modules/tailwindcss', { name: 'tailwindcss', version: '4.0.0' });

    expect(resolvePackageRoot(join(workspace.root, 'app'), { name: 'tailwindcss', resolveFrom: [] })).toBe(root);
  });

  it('resolves a scoped package and looks into parent folders', () => {
    const workspace = createWorkspace();
    const name = '@fontsource-variable/manrope';
    const root = workspace.writePackage(`node_modules/${name}`, { name, version: '5.0.0' });

    expect(resolvePackageRoot(join(workspace.root, 'apps', 'web'), { name, resolveFrom: [] })).toBe(root);
  });

  it('resolves a package through a chain of dependencies in the pnpm layout', () => {
    const workspace = createWorkspace();
    const pnpm = 'node_modules/.pnpm';

    workspace.writePackage(`${pnpm}/vite-plugin-pwa@1.0.0/node_modules/vite-plugin-pwa`, { name: 'vite-plugin-pwa', version: '1.0.0' });
    workspace.writePackage(`${pnpm}/workbox-build@7.0.0/node_modules/workbox-build`, { name: 'workbox-build', version: '7.0.0' });
    const core = workspace.writePackage(`${pnpm}/workbox-core@7.0.1/node_modules/workbox-core`, { name: 'workbox-core', version: '7.0.1' });

    workspace.link(`${pnpm}/vite-plugin-pwa@1.0.0/node_modules/vite-plugin-pwa`, 'apps/web/node_modules/vite-plugin-pwa');
    workspace.link(`${pnpm}/workbox-build@7.0.0/node_modules/workbox-build`, `${pnpm}/vite-plugin-pwa@1.0.0/node_modules/workbox-build`);
    workspace.link(`${pnpm}/workbox-core@7.0.1/node_modules/workbox-core`, `${pnpm}/workbox-build@7.0.0/node_modules/workbox-core`);

    const resolved = resolvePackageRoot(join(workspace.root, 'apps', 'web'), {
      name: 'workbox-core',
      resolveFrom: ['vite-plugin-pwa', 'workbox-build'],
    });

    expect(resolved).toBe(realpathSync(core));
  });

  it('returns nothing when a package of the chain is not installed', () => {
    const workspace = createWorkspace();

    workspace.writePackage('app/node_modules/vite', { name: 'vite', version: '8.0.0' });

    expect(resolvePackageRoot(join(workspace.root, 'app'), { name: 'rolldown', resolveFrom: ['vite'] })).toBeUndefined();
    expect(resolvePackageRoot(join(workspace.root, 'app'), { name: 'rolldown', resolveFrom: ['missing'] })).toBeUndefined();
    expect(resolvePackageRoot(join(workspace.root, 'app'), { name: 'absent', resolveFrom: [] })).toBeUndefined();
  });
});
