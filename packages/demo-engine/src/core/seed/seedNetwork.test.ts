import { CityTier } from '@skladburg/contracts/network/v1/network';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { SeedCityId } from './seedIds';
import { createSeedCities } from './seedNetwork';

describe('createSeedCities', () => {
  it('assigns a tier to every city', () => {
    const cities = createSeedCities();

    expect(cities).toHaveLength(9);
    for (const city of cities) {
      expect(city.tier, city.name).not.toBe(CityTier.UNSPECIFIED);
    }
  });

  it('makes Moscow and Saint Petersburg large cities', () => {
    const tierByCityId = new Map(createSeedCities().map(city => [city.id, city.tier]));

    expect(tierByCityId.get(SeedCityId.MOSCOW)).toBe(CityTier.LARGE);
    expect(tierByCityId.get(SeedCityId.SAINT_PETERSBURG)).toBe(CityTier.LARGE);
  });
});
