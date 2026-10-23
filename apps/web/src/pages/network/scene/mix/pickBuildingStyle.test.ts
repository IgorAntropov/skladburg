import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkCityTierValue } from '@/entities/network';

import type { BuildingStyleValue } from './pickBuildingStyle';

import { MODEL_SHARE_MAX } from './mixConstants';
import {
  createMixBuilding,
  createSyntheticBuildings,
} from './mixTestSupport';
import {
  measureModelShare,
  pickBuildingStyle,
} from './pickBuildingStyle';

const SAMPLE_SIZE = 4000;
const TOLERANCE = 0.03;
const TIERS: readonly NetworkCityTierValue[] = ['small', 'medium', 'large'];

const countShares = (
  tier: NetworkCityTierValue,
  kind: 'house' | 'office',
): Record<BuildingStyleValue, number> => {
  const counts: Record<BuildingStyleValue, number> = { beveled: 0, box: 0, model: 0 };

  for (const building of createSyntheticBuildings(SAMPLE_SIZE, { kind })) {
    counts[pickBuildingStyle(building, tier)] += 1;
  }

  return { beveled: counts.beveled / SAMPLE_SIZE, box: counts.box / SAMPLE_SIZE, model: counts.model / SAMPLE_SIZE };
};

describe('measureModelShare', () => {
  it('follows the scale of the tier with the office bonus under the ceiling', () => {
    expect(measureModelShare({ kind: 'house' }, 'large')).toBeCloseTo(0.75, 10);
    expect(measureModelShare({ kind: 'house' }, 'medium')).toBeCloseTo(0.625, 10);
    expect(measureModelShare({ kind: 'house' }, 'small')).toBeCloseTo(0.425, 10);
    expect(measureModelShare({ kind: 'office' }, 'small')).toBeCloseTo(0.525, 10);
    expect(measureModelShare({ kind: 'office' }, 'large')).toBe(MODEL_SHARE_MAX);
  });
});

describe('pickBuildingStyle', () => {
  it('always gives a model to the building of a company', () => {
    for (const tier of TIERS) {
      for (const id of ['site-1', 'site-2', 'site-3', 'site-4']) {
        expect(pickBuildingStyle(createMixBuilding(id, { isCompany: true, kind: 'warehouse' }), tier)).toBe('model');
      }
    }
  });

  it('depends only on the id, the kind and the tier', () => {
    const building = createMixBuilding('decor:a:1');
    const moved = createMixBuilding('decor:a:1', { cityId: 'other', rank: 0.9, x: 40, z: 11 });

    for (const tier of TIERS) {
      expect(pickBuildingStyle(moved, tier)).toBe(pickBuildingStyle(building, tier));
    }
  });

  it('gives more models to a bigger tier on a large sample', () => {
    const [small, medium, large] = TIERS.map(tier => countShares(tier, 'house').model);

    expect(small).toBeLessThan(medium ?? 0);
    expect(medium).toBeLessThan(large ?? 0);

    for (const tier of TIERS) {
      expect(Math.abs(countShares(tier, 'house').model - measureModelShare({ kind: 'house' }, tier))).toBeLessThan(TOLERANCE);
    }
  });

  it('gives offices the extra share of models', () => {
    for (const tier of TIERS) {
      const shares = countShares(tier, 'office');
      const houseShares = countShares(tier, 'house');

      expect(Math.abs(shares.model - measureModelShare({ kind: 'office' }, tier))).toBeLessThan(TOLERANCE);
      expect(shares.model).toBeGreaterThan(houseShares.model);
    }
  });

  it('splits the rest in half between the beveled and the plain boxes', () => {
    for (const tier of TIERS) {
      for (const kind of ['house', 'office'] as const) {
        const shares = countShares(tier, kind);
        const rest = 1 - shares.model;

        expect(Math.abs(shares.beveled - rest / 2)).toBeLessThan(TOLERANCE);
        expect(Math.abs(shares.box - rest / 2)).toBeLessThan(TOLERANCE);
      }
    }
  });
});
