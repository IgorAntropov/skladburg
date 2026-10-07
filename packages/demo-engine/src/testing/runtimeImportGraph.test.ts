import {
  dirname,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { collectRuntimeModules } from './runtimeImportGraph';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_ROOT = resolve(SOURCE_ROOT, 'core');

const collectFrom = (relativeEntry: string): string[] => collectRuntimeModules(resolve(SOURCE_ROOT, relativeEntry));

describe('runtime import graph of the package entries', () => {
  it('keeps the client entry free of the core and of the host', () => {
    const modules = collectFrom('client/index.ts');

    expect(modules.filter(modulePath => modulePath.startsWith(`${CORE_ROOT}/`))).toEqual([]);
    expect(modules.filter(modulePath => modulePath.startsWith(`${resolve(SOURCE_ROOT, 'host')}/`))).toEqual([]);
    expect(modules).toContain(resolve(SOURCE_ROOT, 'client/connectToEngine.ts'));
  });

  it('does not reach the core from the worker entry without a dynamic import', () => {
    const modules = collectFrom('host/worker.ts');
    const coreModules = modules.filter(modulePath => modulePath.startsWith(`${CORE_ROOT}/`));

    expect(coreModules.every(modulePath => modulePath.startsWith(`${resolve(CORE_ROOT, 'ports')}/`))).toBe(true);
  });

  it('sees runtime imports and ignores type-only ones', () => {
    const modules = collectFrom('host/hostTypes.ts');

    expect(modules).toEqual([resolve(SOURCE_ROOT, 'host/hostTypes.ts')]);
  });
});
