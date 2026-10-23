import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  listWorldModelsForLevel,
  WORLD_MODEL_LODS_BY_LEVEL,
} from './worldModelLods';

describe('listWorldModelsForLevel', () => {
  it('shows the full houses on high and medium and the light ones on low', () => {
    for (const level of ['high', 'medium'] as const) {
      const entries = listWorldModelsForLevel('house', level);

      expect(entries).toHaveLength(5);
      expect(entries.every(entry => entry.lod === 'full')).toBe(true);
    }

    const lowEntries = listWorldModelsForLevel('house', 'low');

    expect(lowEntries.map(entry => entry.sourceName)).toEqual([
      'low-detail-building-n',
      'low-detail-building-wide-a',
      'low-detail-building-wide-b',
    ]);
  });

  it('falls back to the full models for a group without light ones', () => {
    for (const level of ['high', 'medium', 'low'] as const) {
      expect(listWorldModelsForLevel('office', level).map(entry => entry.lod)).toEqual(['full', 'full', 'full', 'full', 'full']);
      expect(listWorldModelsForLevel('warehouse', level).map(entry => entry.id)).toEqual(['industrial/building-k']);
    }
  });

  it('keeps only the models of the asked group', () => {
    expect(listWorldModelsForLevel('office', 'low').every(entry => entry.group === 'office')).toBe(true);
  });

  it('asks the light variant only on the low level', () => {
    expect(WORLD_MODEL_LODS_BY_LEVEL).toEqual({ high: 'full', low: 'light', medium: 'full' });
  });
});
