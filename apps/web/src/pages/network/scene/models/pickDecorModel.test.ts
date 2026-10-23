import {
  describe,
  expect,
  it,
} from 'vitest';

import type { QualityLevelValue } from '@/shared/3d';

import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelEntryValue } from './worldModelCatalog';

import { createMixBuilding } from '../mix/mixTestSupport';
import { measureFootprintStretch } from './fitWorldModelToFootprint';
import { MAX_MODEL_STRETCH } from './modelFitConstants';
import { pickDecorModel } from './pickDecorModel';
import { listWorldModelsForLevel } from './worldModelLods';

const LEVELS: readonly QualityLevelValue[] = ['low', 'medium', 'high'];
const SAMPLE_SIZE = 600;

const measure = (entry: WorldModelEntryValue, building: NetworkSceneBuildingValue): number => (
  measureFootprintStretch(entry.footprint[0], entry.footprint[1], building)
);

describe('pickDecorModel', () => {
  it('gives nothing to a warehouse', () => {
    expect(pickDecorModel(createMixBuilding('site', { kind: 'warehouse' }), 'high')).toBeUndefined();
  });

  it('is a function of the id and the size only', () => {
    const building = createMixBuilding('decor:a:3');
    const moved = createMixBuilding('decor:a:3', { cityId: 'other', rank: 0.1, rotation: 2, x: 30, z: 9 });

    for (const level of LEVELS) {
      expect(pickDecorModel(moved, level)).toBe(pickDecorModel(building, level));
    }
  });

  it('takes a house from its own group and the light ones on the low level', () => {
    for (let index = 0; index < SAMPLE_SIZE; index += 1) {
      const building = createMixBuilding(`decor:a:${String(index)}`);
      const low = pickDecorModel(building, 'low');
      const high = pickDecorModel(building, 'high');

      expect(low?.group).toBe('house');
      expect(low?.lod).toBe('light');
      expect(high?.group).toBe('house');
      expect(high?.lod).toBe('full');
    }
  });

  it('takes an office from the offices of the level', () => {
    for (let index = 0; index < SAMPLE_SIZE; index += 1) {
      const entry = pickDecorModel(createMixBuilding(`decor:b:${String(index)}`, { depth: 1.4, kind: 'office', width: 1.4 }), 'medium');

      expect(entry?.group).toBe('office');
    }
  });

  it('keeps the stretch of the model under the limit when the group has models that fit', () => {
    let checkedCount = 0;

    for (const level of LEVELS) {
      for (let index = 0; index < SAMPLE_SIZE; index += 1) {
        const building = createMixBuilding(`decor:c:${String(index)}`, { depth: 1 + (index % 5) * 0.1, width: 1.1 + (index % 6) * 0.1 });
        const hasFitting = listWorldModelsForLevel('house', level).some(candidate => measure(candidate, building) <= MAX_MODEL_STRETCH);
        const entry = pickDecorModel(building, level);

        if (hasFitting) {
          checkedCount += 1;
          expect(entry === undefined ? Infinity : measure(entry, building)).toBeLessThanOrEqual(MAX_MODEL_STRETCH);
        }
      }
    }

    expect(checkedCount).toBeGreaterThan(SAMPLE_SIZE);
  });

  it('falls back to the least stretched model when none fits', () => {
    const building = createMixBuilding('decor:d:1', { depth: 0.4, width: 3 });
    const entry = pickDecorModel(building, 'high');
    const least = Math.min(...listWorldModelsForLevel('house', 'high').map(candidate => measure(candidate, building)));

    expect(least).toBeGreaterThan(MAX_MODEL_STRETCH);
    expect(entry === undefined ? undefined : measure(entry, building)).toBe(least);
  });

  it('uses more than one model of the group', () => {
    const used = new Set<string | undefined>();

    for (let index = 0; index < SAMPLE_SIZE; index += 1) {
      used.add(pickDecorModel(createMixBuilding(`decor:e:${String(index)}`), 'high')?.id);
    }

    expect(used.size).toBeGreaterThan(2);
  });
});
