import { create } from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { CitySchema } from '../gen/network/v1/network_pb';
import { collectViolations } from './collectViolations';

describe('City local delivery profile', () => {
  it('accepts a legacy city and a city with positive distance and time', () => {
    expect(collectViolations(CitySchema, create(CitySchema))).toEqual([]);
    expect(collectViolations(CitySchema, create(CitySchema, {
      localDeliveryProfile: { distanceKm: 22, driveMinutes: 60 },
    }))).toEqual([]);
  });

  it('rejects a profile with zero distance and negative time', () => {
    expect(collectViolations(CitySchema, create(CitySchema, {
      localDeliveryProfile: { distanceKm: 0, driveMinutes: -1 },
    }))).toEqual([
      { fieldPath: 'local_delivery_profile.distance_km', ruleId: 'int32.gt' },
      { fieldPath: 'local_delivery_profile.drive_minutes', ruleId: 'int32.gt' },
    ]);
  });
});
