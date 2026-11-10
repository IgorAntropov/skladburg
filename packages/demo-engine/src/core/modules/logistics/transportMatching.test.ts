import type { TransportCargo } from '@skladburg/contracts/logistics/v1/logistics_records';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';
import {
  TransportRequestRecordSchema,
  TransportWindowSchema,
} from '@skladburg/contracts/logistics/v1/logistics_records';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedCityId,
  SeedOrganizationId,
} from '../../seed/index';
import { createTestRuntime } from '../testing/testRuntime';
import { canCarryTransportRequest } from './transportMatching';

type CargoOverridesValue = Partial<Omit<TransportCargo, '$typeName' | '$unknown'>>;

const MINUTE_MS = 60_000;
const START = Date.UTC(2026, 9, 12, 7);
const DRIVE_MINUTES = 240;
const ARRIVAL = START + DRIVE_MINUTES * MINUTE_MS;

const transportRequest = (cargo: CargoOverridesValue = {}): ReturnType<typeof create<typeof TransportRequestRecordSchema>> =>
  create(TransportRequestRecordSchema, {
    cargo: {
      bodyTypes: [VehicleBodyType.LONG_HAUL, VehicleBodyType.LOW_LOADER],
      cargoKind: VehicleCargoKind.OVERSIZE,
      heightMillimeters: 350,
      lengthMillimeters: 12_000,
      volumeCubicCentimeters: 2_100_000n,
      weightGrams: 2_010_000n,
      widthMillimeters: 500,
      ...cargo,
    },
    deliveryWindow: { endsAt: timestampFromMs(ARRIVAL + 30 * MINUTE_MS), startsAt: timestampFromMs(ARRIVAL) },
    driveMinutes: DRIVE_MINUTES,
    fromCityId: SeedCityId.CHELYABINSK,
    pickupWindow: { endsAt: timestampFromMs(START + 30 * MINUTE_MS), startsAt: timestampFromMs(START) },
    toCityId: SeedCityId.YEKATERINBURG,
  });

describe('carrier matching', () => {
  it('matches the long-bed and low-loader fleet for 12 metres in the right direction', () => {
    const { state } = createTestRuntime();
    const request = transportRequest();
    expect(canCarryTransportRequest(state.read, request, SeedOrganizationId.CARRIER_2, START)).toBe(true);
    expect(canCarryTransportRequest(state.read, {
      ...request, fromCityId: request.toCityId, toCityId: request.fromCityId,
    }, SeedOrganizationId.CARRIER_2, START)).toBe(false);
    expect(canCarryTransportRequest(state.read, request, SeedOrganizationId.CARRIER_1, START)).toBe(false);
  });

  it.each([
    { bodyTypes: [VehicleBodyType.FLATBED] },
    { cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED },
    { heightMillimeters: 3_501 },
    { lengthMillimeters: 14_001 },
    { palletPlaces: 34 },
    { temperature: { $typeName: 'catalog.v1.TemperatureRange', maxCelsius: 4, minCelsius: 2 } },
    { volumeCubicCentimeters: 120_000_001n },
    { weightGrams: 36_000_001n },
    { widthMillimeters: 2_501 },
  ] satisfies CargoOverridesValue[])('rejects cargo with an unmet constraint %o', (cargo) => {
    const { state } = createTestRuntime();
    expect(canCarryTransportRequest(state.read, transportRequest(cargo), SeedOrganizationId.CARRIER_2, START)).toBe(false);
  });

  it('uses the local departure weekday and rejects elapsed or unreachable windows', () => {
    const { state } = createTestRuntime();
    const request = transportRequest();
    const fridayInUtc = Date.UTC(2026, 9, 16, 20);
    const saturdayPickup = {
      ...request,
      deliveryWindow: create(TransportWindowSchema, {
        endsAt: timestampFromMs(fridayInUtc + 300 * MINUTE_MS),
        startsAt: timestampFromMs(fridayInUtc + 240 * MINUTE_MS),
      }),
      pickupWindow: create(TransportWindowSchema, {
        endsAt: timestampFromMs(fridayInUtc + 60 * MINUTE_MS),
        startsAt: timestampFromMs(fridayInUtc),
      }),
    };
    const unreachable = transportRequest();
    if (unreachable.deliveryWindow === undefined) {
      throw new Error('Expected a delivery window');
    }
    unreachable.deliveryWindow.endsAt = timestampFromMs(ARRIVAL);
    unreachable.deliveryWindow.startsAt = timestampFromMs(ARRIVAL - MINUTE_MS);
    expect(canCarryTransportRequest(state.read, request, SeedOrganizationId.CARRIER_2, START + 30 * MINUTE_MS)).toBe(false);
    expect(canCarryTransportRequest(state.read, unreachable, SeedOrganizationId.CARRIER_2, START)).toBe(false);
    expect(canCarryTransportRequest(state.read, transportRequest(), SeedOrganizationId.CARRIER_2, START)).toBe(true);
    expect(canCarryTransportRequest(state.read, saturdayPickup, SeedOrganizationId.CARRIER_2, fridayInUtc)).toBe(false);
  });
});
