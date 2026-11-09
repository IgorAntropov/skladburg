import { timestampMs } from '@bufbuild/protobuf/wkt';
import { VehicleBodyType } from '@skladburg/contracts/fleet/v1/fleet';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createEngineState } from '../state/index';
import { DEFAULT_ENGINE_SEED } from './seedConfig';
import { addSeedFleet } from './seedFleet';
import { SeedOrganizationId } from './seedIds';
import { createSeedSnapshot } from './seedSnapshot';

describe('seed fleet', () => {
  it('provides three vehicles to each demo carrier with availability from the world start', () => {
    const worldStartMs = DEFAULT_ENGINE_SEED.worldStartMs + 60_000;
    const snapshot = createSeedSnapshot({ ...DEFAULT_ENGINE_SEED, worldStartMs });
    const { read } = createEngineState(snapshot);
    const northernFleet = read.listBy('vehicles', 'tenantId', SeedOrganizationId.CARRIER_1);
    const wideFleet = read.listBy('vehicles', 'tenantId', SeedOrganizationId.CARRIER_2);

    expect(northernFleet).toHaveLength(3);
    expect(wideFleet).toHaveLength(3);
    expect(northernFleet.filter(vehicle => vehicle.details?.bodyType === VehicleBodyType.REFRIGERATED)).toHaveLength(2);
    const longHaul = wideFleet.find(vehicle => vehicle.details?.bodyType === VehicleBodyType.LONG_HAUL);
    expect(longHaul?.details?.lengthMillimeters).toBe(13_600);
    expect(wideFleet.some(vehicle => vehicle.details?.bodyType === VehicleBodyType.LOW_LOADER)).toBe(true);

    for (const vehicle of [...northernFleet, ...wideFleet]) {
      expect(vehicle.details?.registrationNumber).toMatch(/ 000$/u);
      const [window] = vehicle.details?.availability ?? [];
      expect(window?.startsAt === undefined ? undefined : timestampMs(window.startsAt)).toBe(worldStartMs);
      expect(window?.endsAt === undefined ? undefined : timestampMs(window.endsAt)).toBeGreaterThan(worldStartMs);
      expect(read.get('cities', window?.cityId ?? '')).toBeDefined();
    }
  });

  it('provides drivers and directions for both carrier organizations', () => {
    const { read } = createEngineState(createSeedSnapshot());

    for (const tenantId of [SeedOrganizationId.CARRIER_1, SeedOrganizationId.CARRIER_2]) {
      const drivers = read.listBy('drivers', 'tenantId', tenantId);
      const lanes = read.listBy('carrierLanes', 'tenantId', tenantId);

      expect(drivers).toHaveLength(3);
      expect(lanes).toHaveLength(3);
      expect(drivers.every(driver => driver.isActive && driver.displayName !== '')).toBe(true);
      expect(lanes.every(lane => lane.isActive && lane.tariff?.currencyCode === 'RUB')).toBe(true);
    }
  });

  it('adds absent fleet records without replacing prior data', () => {
    const snapshot = createSeedSnapshot();
    const originalVehicleId = 'e1000001-0000-4000-8000-000000000000';
    const savedBytes = Uint8Array.of(1, 2, 3);
    const saved = {
      ...snapshot,
      collections: {
        ...snapshot.collections,
        carrierLanes: new Map(),
        drivers: new Map(),
        vehicles: new Map([[originalVehicleId, savedBytes]]),
      },
      schemaVersion: 15,
    };

    const migrated = addSeedFleet(saved);

    expect(migrated.collections.vehicles.get(originalVehicleId)).toBe(savedBytes);
    expect(migrated.collections.vehicles.size).toBe(6);
    expect(migrated.collections.drivers.size).toBe(6);
    expect(migrated.collections.carrierLanes.size).toBe(6);
    expect(migrated.collections.deals).toBe(saved.collections.deals);
    expect(migrated.collections.documents).toBe(saved.collections.documents);
    expect(migrated.collections.payments).toBe(saved.collections.payments);
    expect(migrated.meta).toBe(saved.meta);
    expect(addSeedFleet(migrated)).toEqual(migrated);
  });
});
