import { build } from 'vite';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempWorkspaceValue } from './createTempWorkspace.ts';
import type { ThirdPartyLicensesOptionsValue } from './licenseTypes.ts';

import { createTempWorkspace } from './createTempWorkspace.ts';
import { createThirdPartyLicenses } from './createThirdPartyLicenses.ts';

const FILE_NAME = 'third-party-licenses.txt';

const MAIN_SOURCE = [
  'import { readMain } from "main-package";',
  'console.log(readMain(location.href));',
  'new Worker(new URL("./task.js", import.meta.url), { type: "module" });',
  '',
].join('\n');

const TASK_SOURCE = [
  'import { readWorker } from "worker-package";',
  'self.postMessage(readWorker(self.name));',
  '',
].join('\n');

const workspaces: TempWorkspaceValue[] = [];

const createWorkspace = (mainLicenseText: null | string = 'main license'): TempWorkspaceValue => {
  const workspace = createTempWorkspace();

  workspaces.push(workspace);

  const mainManifest = { license: 'MIT', main: 'index.js', name: 'main-package', version: '1.0.0' };
  const workerManifest = { license: 'ISC', main: 'index.js', name: 'worker-package', version: '2.0.0' };
  const extraManifest = { license: 'OFL-1.1', name: 'extra-package', version: '3.0.0' };

  workspace.writePackage('node_modules/main-package', mainManifest, mainLicenseText ?? undefined);
  workspace.writeFile('node_modules/main-package/index.js', 'export const readMain = input => input.length + Math.random();\n');
  workspace.writePackage('node_modules/worker-package', workerManifest, 'worker license');
  workspace.writeFile('node_modules/worker-package/index.js', 'export const readWorker = input => input.length + Math.random();\n');
  workspace.writePackage('node_modules/extra-package', extraManifest, 'extra license');
  workspace.writeFile('main.js', MAIN_SOURCE);
  workspace.writeFile('task.js', TASK_SOURCE);

  return workspace;
};

const runBuild = async (
  workspace: TempWorkspaceValue,
  allowedLicenses: readonly string[],
  fallbackOptions: Pick<ThirdPartyLicensesOptionsValue, 'fallbackDirectory' | 'fallbackTexts'> = {},
): Promise<string | undefined> => {
  const licenses = createThirdPartyLicenses({
    allowedLicenses,
    appRoot: workspace.root,
    extraPackages: [{ name: 'extra-package', resolveFrom: [] }],
    fileName: FILE_NAME,
    ...fallbackOptions,
  });

  const result = await build({
    build: { rolldownOptions: { input: 'main.js' }, write: false },
    configFile: false,
    logLevel: 'silent',
    plugins: [licenses.plugin],
    root: workspace.root,
    worker: { format: 'es', plugins: () => [licenses.workerPlugin()] },
  });

  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : [];
  const asset = outputs.find(output => output.fileName === FILE_NAME);

  return asset?.type === 'asset' && typeof asset.source === 'string' ? asset.source : undefined;
};

describe('createThirdPartyLicenses', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }
  });

  it('emits the licenses of the main bundle, of the worker bundle and of the extra packages', async () => {
    const source = await runBuild(createWorkspace(), ['MIT', 'ISC', 'OFL-1.1']);

    expect(source).toBeDefined();
    expect(source).toContain('main-package 1.0.0\nLicense: MIT\n\nmain license');
    expect(source).toContain('worker-package 2.0.0\nLicense: ISC\n\nworker license');
    expect(source).toContain('extra-package 3.0.0\nLicense: OFL-1.1\n\nextra license');
  });

  it('fails the build when a package of the worker has a license outside the allowed list', async () => {
    await expect(runBuild(createWorkspace(), ['MIT', 'OFL-1.1'])).rejects.toThrow(
      'Third-party licenses: worker-package@2.0.0 has license "ISC" which is not allowed in the bundle',
    );
  });

  it('emits the fallback text of a package without a license file in the package', async () => {
    const workspace = createWorkspace(null);

    workspace.writeFile('fallback/main-package.LICENSE.txt', 'fallback license\n');

    const source = await runBuild(workspace, ['MIT', 'ISC', 'OFL-1.1'], {
      fallbackDirectory: `${workspace.root}/fallback`,
      fallbackTexts: [{ files: ['main-package.LICENSE.txt'], license: 'MIT', name: 'main-package' }],
    });

    expect(source).toContain('main-package 1.0.0\nLicense: MIT\n\nfallback license\n');
  });

  it('fails the build when a package has neither a license file nor a fallback text', async () => {
    await expect(runBuild(createWorkspace(null), ['MIT', 'ISC', 'OFL-1.1'])).rejects.toThrow(
      'Third-party licenses: main-package@1.0.0 has no license file (LICENSE, LICENCE or COPYING)',
    );
  });
});
