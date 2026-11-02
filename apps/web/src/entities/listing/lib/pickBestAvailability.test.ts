import type { CityAvailability } from '@skladburg/contracts/catalog/v1/showcase';

import { create } from '@bufbuild/protobuf';
import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { CityAvailabilitySchema } from '@skladburg/contracts/catalog/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { pickBestAvailability } from './pickBestAvailability';

const createCity = (status: AvailabilityStatus): CityAvailability => create(CityAvailabilitySchema, { status });

describe('pickBestAvailability', () => {
  it('is undefined without cities', () => {
    expect(pickBestAvailability([])).toBeUndefined();
  });

  it('is undefined while no city has a status', () => {
    expect(pickBestAvailability([createCity(AvailabilityStatus.UNSPECIFIED)])).toBeUndefined();
  });

  it('prefers in stock over low and on order', () => {
    const cities = [
      createCity(AvailabilityStatus.ON_ORDER),
      createCity(AvailabilityStatus.IN_STOCK),
      createCity(AvailabilityStatus.LOW),
    ];

    expect(pickBestAvailability(cities)).toBe(AvailabilityStatus.IN_STOCK);
  });

  it('prefers low over on order', () => {
    const cities = [createCity(AvailabilityStatus.ON_ORDER), createCity(AvailabilityStatus.LOW)];

    expect(pickBestAvailability(cities)).toBe(AvailabilityStatus.LOW);
  });

  it('returns the only status', () => {
    expect(pickBestAvailability([createCity(AvailabilityStatus.ON_ORDER)])).toBe(AvailabilityStatus.ON_ORDER);
  });

  it('skips cities without a status', () => {
    const cities = [createCity(AvailabilityStatus.UNSPECIFIED), createCity(AvailabilityStatus.LOW)];

    expect(pickBestAvailability(cities)).toBe(AvailabilityStatus.LOW);
  });
});
