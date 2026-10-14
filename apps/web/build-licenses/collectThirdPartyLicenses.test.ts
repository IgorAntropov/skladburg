import { join } from 'node:path';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempWorkspaceValue } from './createTempWorkspace.ts';
import type {
  CollectedLicensesValue,
  FallbackLicenseTextValue,
} from './licenseTypes.ts';

import { collectThirdPartyLicenses } from './collectThirdPartyLicenses.ts';
import { createTempWorkspace } from './createTempWorkspace.ts';

const ALLOWED = ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', 'OFL-1.1'];

const workspaces: TempWorkspaceValue[] = [];

const createWorkspace = (): TempWorkspaceValue => {
  const workspace = createTempWorkspace();

  workspaces.push(workspace);

  return workspace;
};

const addPackage = (
  workspace: TempWorkspaceValue,
  name: string,
  manifest: Readonly<Record<string, unknown>>,
  licenseText: null | string = `${name} license text`,
): string => {
  workspace.writePackage(`node_modules/${name}`, { name, version: '1.0.0', ...manifest }, licenseText ?? undefined);

  return workspace.writeFile(`node_modules/${name}/index.js`, '');
};

describe('collectThirdPartyLicenses', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }
  });

  it('collects the packages of the modules and sorts them by name and version', () => {
    const workspace = createWorkspace();
    const zustand = addPackage(workspace, 'zustand', { license: 'MIT', version: '5.0.0' });
    const idb = addPackage(workspace, 'idb', { license: 'ISC', repository: 'github:jakearchibald/idb', version: '8.0.4' });
    const scoped = addPackage(workspace, '@tanstack/query-core', { license: 'MIT', version: '5.1.0' });

    const { licenses, violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [zustand, idb, scoped],
    });

    expect(violations).toEqual([]);
    expect(licenses.map(license => `${license.name} ${license.version}`)).toEqual([
      '@tanstack/query-core 5.1.0',
      'idb 8.0.4',
      'zustand 5.0.0',
    ]);
    expect(licenses[1]).toEqual({
      license: 'ISC',
      name: 'idb',
      repository: 'https://github.com/jakearchibald/idb',
      text: 'idb license text',
      version: '8.0.4',
    });
  });

  it('counts a package once however many modules and roots it comes from', () => {
    const workspace = createWorkspace();
    const first = addPackage(workspace, 'react', { license: 'MIT', version: '19.0.0' });
    const second = workspace.writePackage('node_modules/.pnpm/react@19.0.0_peer/node_modules/react', {
      license: 'MIT',
      name: 'react',
      version: '19.0.0',
    }, 'react license text');
    const sibling = workspace.writeFile('node_modules/react/jsx-runtime.js', '');

    const { licenses } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [first, sibling, `${second}/index.js`, first],
    });

    expect(licenses).toHaveLength(1);
  });

  it('keeps two versions of one package', () => {
    const workspace = createWorkspace();
    const manifest = { license: '0BSD', name: 'tslib' };
    const old = workspace.writePackage('node_modules/.pnpm/tslib@1.0.0/node_modules/tslib', { ...manifest, version: '1.0.0' }, 'old');
    const current = workspace.writePackage('node_modules/tslib', { ...manifest, version: '2.0.0' }, 'new');

    const { licenses } = collectThirdPartyLicenses({
      allowedLicenses: ['0BSD'],
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [`${old}/index.js`, `${current}/index.js`],
    });

    expect(licenses.map(license => license.version)).toEqual(['1.0.0', '2.0.0']);
  });

  it('ignores own packages, virtual modules and modules outside node_modules', () => {
    const workspace = createWorkspace();
    const own = addPackage(workspace, '@skladburg/contracts', { license: 'UNLICENSED' }, null);
    const source = workspace.writeFile('src/main.ts', '');

    const { licenses, violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [own, source, '\0vite/preload-helper.js'],
    });

    expect(licenses).toEqual([]);
    expect(violations).toEqual([]);
  });

  it('reports a license outside the allowed list', () => {
    const workspace = createWorkspace();
    const gpl = addPackage(workspace, 'copyleft', { license: 'GPL-3.0', version: '2.1.0' });
    const either = addPackage(workspace, 'either', { license: '(MIT OR GPL-3.0)' });
    const both = addPackage(workspace, 'both', { license: 'GPL-3.0 AND MIT' });

    const { licenses, violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [gpl, either, both],
    });

    expect(licenses.map(license => license.name)).toEqual(['either']);
    expect(violations).toEqual([
      'Third-party licenses: both@1.0.0 has license "GPL-3.0 AND MIT" which is not allowed in the bundle',
      'Third-party licenses: copyleft@2.1.0 has license "GPL-3.0" which is not allowed in the bundle',
    ]);
  });

  it('reports a missing license field', () => {
    const workspace = createWorkspace();
    const unlicensed = addPackage(workspace, 'nolicense', {});

    const { licenses, violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [unlicensed],
    });

    expect(licenses).toEqual([]);
    expect(violations).toEqual(['Third-party licenses: nolicense@1.0.0 has no license field in package.json']);
  });

  it('reports a missing license file', () => {
    const workspace = createWorkspace();
    const bare = addPackage(workspace, 'bare', { license: 'MIT' }, null);

    const { licenses, violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [bare],
    });

    expect(licenses).toEqual([]);
    expect(violations).toEqual(['Third-party licenses: bare@1.0.0 has no license file (LICENSE, LICENCE or COPYING)']);
  });

  it('reports every problem of a package and of every other package at once', () => {
    const workspace = createWorkspace();
    const worst = addPackage(workspace, 'worst', { license: 'AGPL-3.0' }, null);
    const bare = addPackage(workspace, 'bare', { license: 'MIT' }, null);

    const { violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [],
      moduleIds: [worst, bare],
    });

    expect(violations).toEqual([
      'Third-party licenses: bare@1.0.0 has no license file (LICENSE, LICENCE or COPYING)',
      'Third-party licenses: worst@1.0.0 has license "AGPL-3.0" which is not allowed in the bundle',
      'Third-party licenses: worst@1.0.0 has no license file (LICENSE, LICENCE or COPYING)',
    ]);
  });

  it('adds the extra packages resolved from the app root and through a chain', () => {
    const workspace = createWorkspace();

    const manifest = { license: 'MIT', version: '1.0.0' };

    workspace.writePackage('apps/web/node_modules/tailwindcss', { ...manifest, name: 'tailwindcss' }, 'tailwind text');
    workspace.writePackage('apps/web/node_modules/vite', { ...manifest, name: 'vite' }, 'vite text');
    workspace.writePackage('apps/web/node_modules/vite/node_modules/rolldown', { ...manifest, name: 'rolldown' }, 'rolldown text');

    const { licenses, violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: `${workspace.root}/apps/web`,
      extraPackages: [
        { name: 'tailwindcss', resolveFrom: [] },
        { name: 'rolldown', resolveFrom: ['vite'] },
      ],
      moduleIds: [],
    });

    expect(violations).toEqual([]);
    expect(licenses.map(license => license.name)).toEqual(['rolldown', 'tailwindcss']);
  });

  it('reports an extra package that cannot be resolved', () => {
    const workspace = createWorkspace();

    const { violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [
        { name: 'workbox-core', resolveFrom: ['vite-plugin-pwa', 'workbox-build'] },
        { name: 'absent', resolveFrom: [] },
      ],
      moduleIds: [],
    });

    expect(violations).toEqual([
      'Third-party licenses: workbox-core cannot be resolved (vite-plugin-pwa -> workbox-build -> workbox-core)',
      'Third-party licenses: absent cannot be resolved (absent)',
    ]);
  });

  it('checks an extra package against the allowed licenses too', () => {
    const workspace = createWorkspace();

    workspace.writePackage('node_modules/font', { license: 'CC-BY-4.0', name: 'font', version: '3.0.0' }, 'font text');

    const { violations } = collectThirdPartyLicenses({
      allowedLicenses: ALLOWED,
      appRoot: workspace.root,
      extraPackages: [{ name: 'font', resolveFrom: [] }],
      moduleIds: [],
    });

    expect(violations).toEqual(['Third-party licenses: font@3.0.0 has license "CC-BY-4.0" which is not allowed in the bundle']);
  });

  describe('fallback texts', () => {
    const FALLBACK_DIRECTORY_NAME = 'fallback-texts';

    const collectWithFallback = (
      workspace: TempWorkspaceValue,
      moduleIds: string[],
      fallbackTexts: readonly FallbackLicenseTextValue[],
    ): CollectedLicensesValue =>
      collectThirdPartyLicenses({
        allowedLicenses: ALLOWED,
        appRoot: workspace.root,
        extraPackages: [],
        fallbackDirectory: join(workspace.root, FALLBACK_DIRECTORY_NAME),
        fallbackTexts,
        moduleIds,
      });

    it('takes the fallback text when the package has no license file', () => {
      const workspace = createWorkspace();
      const bare = addPackage(workspace, 'bare', { license: 'MIT' }, null);

      workspace.writeFile(`${FALLBACK_DIRECTORY_NAME}/bare.LICENSE.txt`, 'fallback text\n');

      const { licenses, violations } = collectWithFallback(workspace, [bare], [
        { files: ['bare.LICENSE.txt'], license: 'MIT', name: 'bare' },
      ]);

      expect(violations).toEqual([]);
      expect(licenses.map(license => license.text)).toEqual(['fallback text']);
    });

    it('joins several fallback files in the order of the table', () => {
      const workspace = createWorkspace();
      const bare = addPackage(workspace, 'bare', { license: '(Apache-2.0 AND BSD-3-Clause)' }, null);

      workspace.writeFile(`${FALLBACK_DIRECTORY_NAME}/second.txt`, 'second text\n');
      workspace.writeFile(`${FALLBACK_DIRECTORY_NAME}/first.txt`, 'first text\n');

      const { licenses } = collectWithFallback(workspace, [bare], [
        { files: ['first.txt', 'second.txt'], license: '(Apache-2.0 AND BSD-3-Clause)', name: 'bare' },
      ]);

      expect(licenses.map(license => license.text)).toEqual(['first text\n\nsecond text']);
    });

    it('prefers the text from the package over the fallback text', () => {
      const workspace = createWorkspace();
      const own = addPackage(workspace, 'own', { license: 'MIT' }, 'package text');

      workspace.writeFile(`${FALLBACK_DIRECTORY_NAME}/own.LICENSE.txt`, 'fallback text');

      const { licenses, violations } = collectWithFallback(workspace, [own], [
        { files: ['own.LICENSE.txt'], license: 'MIT', name: 'own' },
      ]);

      expect(violations).toEqual([]);
      expect(licenses.map(license => license.text)).toEqual(['package text']);
    });

    it('prefers the text from the package even when the recorded license differs', () => {
      const workspace = createWorkspace();
      const own = addPackage(workspace, 'own', { license: 'ISC' }, 'package text');

      const { licenses, violations } = collectWithFallback(workspace, [own], [
        { files: ['absent.txt'], license: 'MIT', name: 'own' },
      ]);

      expect(violations).toEqual([]);
      expect(licenses.map(license => license.text)).toEqual(['package text']);
    });

    it('fails when the license of the package changed since the fallback text was recorded', () => {
      const workspace = createWorkspace();
      const bare = addPackage(workspace, 'bare', { license: 'ISC', version: '2.0.0' }, null);

      workspace.writeFile(`${FALLBACK_DIRECTORY_NAME}/bare.LICENSE.txt`, 'fallback text');

      const { licenses, violations } = collectWithFallback(workspace, [bare], [
        { files: ['bare.LICENSE.txt'], license: 'MIT', name: 'bare' },
      ]);

      expect(licenses).toEqual([]);
      expect(violations).toEqual([
        'Third-party licenses: bare@2.0.0 has no license file '
        + 'and its fallback text is recorded for license "MIT", but package.json says "ISC"',
      ]);
    });

    it('fails when there is no fallback text for the package', () => {
      const workspace = createWorkspace();
      const bare = addPackage(workspace, 'bare', { license: 'MIT' }, null);

      const { licenses, violations } = collectWithFallback(workspace, [bare], [
        { files: ['other.LICENSE.txt'], license: 'MIT', name: 'other' },
      ]);

      expect(licenses).toEqual([]);
      expect(violations).toEqual(['Third-party licenses: bare@1.0.0 has no license file (LICENSE, LICENCE or COPYING)']);
    });

    it('fails when the fallback file is missing on disk', () => {
      const workspace = createWorkspace();
      const bare = addPackage(workspace, 'bare', { license: 'MIT' }, null);

      const { licenses, violations } = collectWithFallback(workspace, [bare], [
        { files: ['bare.LICENSE.txt'], license: 'MIT', name: 'bare' },
      ]);

      expect(licenses).toEqual([]);
      expect(violations).toEqual([
        'Third-party licenses: bare@1.0.0 has no license file and its fallback text file "bare.LICENSE.txt" is missing or empty',
      ]);
    });

    it('fails when the fallback file is empty', () => {
      const workspace = createWorkspace();
      const bare = addPackage(workspace, 'bare', { license: 'MIT' }, null);

      workspace.writeFile(`${FALLBACK_DIRECTORY_NAME}/bare.LICENSE.txt`, '\n');

      const { violations } = collectWithFallback(workspace, [bare], [
        { files: ['bare.LICENSE.txt'], license: 'MIT', name: 'bare' },
      ]);

      expect(violations).toEqual([
        'Third-party licenses: bare@1.0.0 has no license file and its fallback text file "bare.LICENSE.txt" is missing or empty',
      ]);
    });

    it('does not use the fallback text for a license outside the allowed list', () => {
      const workspace = createWorkspace();
      const copyleft = addPackage(workspace, 'copyleft', { license: 'GPL-3.0' }, null);

      workspace.writeFile(`${FALLBACK_DIRECTORY_NAME}/copyleft.LICENSE.txt`, 'fallback text');

      const { licenses, violations } = collectWithFallback(workspace, [copyleft], [
        { files: ['copyleft.LICENSE.txt'], license: 'GPL-3.0', name: 'copyleft' },
      ]);

      expect(licenses).toEqual([]);
      expect(violations).toEqual([
        'Third-party licenses: copyleft@1.0.0 has license "GPL-3.0" which is not allowed in the bundle',
        'Third-party licenses: copyleft@1.0.0 has no license file (LICENSE, LICENCE or COPYING)',
      ]);
    });
  });
});
