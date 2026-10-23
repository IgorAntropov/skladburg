import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { BYTES_PER_KILOBYTE } from '../build-budget/bundleBudgetConstants.ts';
import { readWorldModel } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import {
  buildWorldModelPath,
  COMPANY_WAREHOUSE_MODEL_ID,
  WORLD_MODEL_CATALOG,
} from '../src/pages/network/scene/models/worldModelCatalog.ts';

const appRoot = join(import.meta.dirname, '..');

const modelsRoot = join(appRoot, 'public', 'models');

const BUDGET_KILOBYTES = 300;

const KITS = ['commercial', 'industrial'] as const;

const listBinFiles = (): string[] => readdirSync(modelsRoot, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.bin'))
  .map(entry => join(entry.parentPath, entry.name));

describe('world model files', () => {
  it('lists 14 models with unique ids and paths', () => {
    expect(WORLD_MODEL_CATALOG).toHaveLength(14);
    expect(new Set(WORLD_MODEL_CATALOG.map(({ id }) => id)).size).toBe(14);
    expect(new Set(WORLD_MODEL_CATALOG.map(buildWorldModelPath)).size).toBe(14);
    expect(WORLD_MODEL_CATALOG.some(({ id }) => id === COMPANY_WAREHOUSE_MODEL_ID)).toBe(true);
  });

  it.each(WORLD_MODEL_CATALOG)('has a readable file for $id', (entry) => {
    const data = readWorldModel(Uint8Array.from(readFileSync(join(appRoot, 'public', buildWorldModelPath(entry)))).buffer);

    expect(data.triangleCount).toBeGreaterThan(0);
    expect(data.bounds.min[1]).toBe(0);
  });

  it('has no other .bin files than the catalog', () => {
    const expected = WORLD_MODEL_CATALOG.map(entry => join(appRoot, 'public', buildWorldModelPath(entry))).toSorted();

    expect(listBinFiles().toSorted()).toEqual(expected);
  });

  it.each(KITS)('keeps the license of the %s kit next to its models', (kit) => {
    const path = join(modelsRoot, kit, 'License.txt');

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain('Creative Commons Zero');
  });

  it('weighs at most 300 kB raw', () => {
    const totalBytes = listBinFiles().reduce((sum, path) => sum + statSync(path).size, 0);

    expect(totalBytes).toBeLessThanOrEqual(BUDGET_KILOBYTES * BYTES_PER_KILOBYTE);
  });
});
