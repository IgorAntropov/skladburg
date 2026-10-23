import { CityTier } from '@skladburg/contracts/network/v1/network';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { toNetworkCityTier } from './toNetworkCityTier';

describe('toNetworkCityTier', () => {
  it('maps every known tier', () => {
    expect(toNetworkCityTier(CityTier.LARGE)).toBe('large');
    expect(toNetworkCityTier(CityTier.MEDIUM)).toBe('medium');
    expect(toNetworkCityTier(CityTier.SMALL)).toBe('small');
  });

  it('falls back to medium for an unspecified or unknown tier', () => {
    expect(toNetworkCityTier(CityTier.UNSPECIFIED)).toBe('medium');
    const unknownTier: unknown = 99;

    expect(toNetworkCityTier(unknownTier as CityTier)).toBe('medium');
  });
});
