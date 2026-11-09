import type { MessageInitShape } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  type CarrierLane,
  CarrierLaneSchema,
  type Driver,
  DriverSchema,
  type Vehicle,
  VehicleBodyType,
  VehicleCargoKind,
  type VehicleDetailsSchema,
  VehicleSchema,
} from '@skladburg/contracts/fleet/v1/fleet';

import {
  SeedCityId,
  SeedOrganizationId,
} from './seedIds';

export interface SeedFleetRecordsValue {
  carrierLanes: CarrierLane[];
  drivers: Driver[];
  vehicles: Vehicle[];
}

interface SeedLaneValue {
  fromCityId: string;
  number: number;
  tariffMinor: bigint;
  toCityId: string;
}

interface SeedParkValue {
  drivers: readonly { displayName: string; number: number }[];
  lanes: readonly SeedLaneValue[];
  tenantId: string;
  vehicles: readonly SeedVehicleValue[];
}

interface SeedVehicleValue {
  cityId: string;
  details: Omit<MessageInitShape<typeof VehicleDetailsSchema>, '$typeName' | '$unknown' | 'availability' | 'registrationNumber'>;
  number: number;
}

const SEED_AVAILABILITY_MS = 30 * 24 * 60 * 60 * 1000;
const WEEKDAYS = [1, 2, 3, 4, 5];

const REFRIGERATED_DETAILS = {
  bodyType: VehicleBodyType.REFRIGERATED,
  cargoKinds: [VehicleCargoKind.GENERAL, VehicleCargoKind.TEMPERATURE_CONTROLLED],
  heightMillimeters: 2_600,
  lengthMillimeters: 13_400,
  palletPlaces: 33,
  payloadGrams: 20_000_000n,
  temperature: { maxCelsius: 12, minCelsius: -20 },
  volumeCubicCentimeters: 85_000_000n,
  widthMillimeters: 2_450,
} satisfies SeedVehicleValue['details'];

const SEED_PARKS: readonly SeedParkValue[] = [
  {
    drivers: [
      { displayName: 'Артём Снегирёв', number: 1 },
      { displayName: 'Инна Ветлугина', number: 2 },
      { displayName: 'Михаил Тальников', number: 3 },
    ],
    lanes: [
      { fromCityId: SeedCityId.KRASNODAR, number: 1, tariffMinor: 7_500_000n, toCityId: SeedCityId.MOSCOW },
      { fromCityId: SeedCityId.VORONEZH, number: 2, tariffMinor: 3_200_000n, toCityId: SeedCityId.MOSCOW },
      { fromCityId: SeedCityId.MOSCOW, number: 3, tariffMinor: 650_000n, toCityId: SeedCityId.MOSCOW },
    ],
    tenantId: SeedOrganizationId.CARRIER_1,
    vehicles: [
      { cityId: SeedCityId.KRASNODAR, details: REFRIGERATED_DETAILS, number: 1 },
      { cityId: SeedCityId.MOSCOW, details: REFRIGERATED_DETAILS, number: 2 },
      {
        cityId: SeedCityId.VORONEZH,
        details: {
          bodyType: VehicleBodyType.INSULATED,
          cargoKinds: [VehicleCargoKind.GENERAL],
          heightMillimeters: 2_400,
          lengthMillimeters: 8_000,
          palletPlaces: 18,
          payloadGrams: 9_000_000n,
          volumeCubicCentimeters: 45_000_000n,
          widthMillimeters: 2_450,
        },
        number: 3,
      },
    ],
  },
  {
    drivers: [
      { displayName: 'Денис Перелесов', number: 4 },
      { displayName: 'Лидия Тихоречная', number: 5 },
      { displayName: 'Роман Меднолесов', number: 6 },
    ],
    lanes: [
      { fromCityId: SeedCityId.CHELYABINSK, number: 4, tariffMinor: 3_850_000n, toCityId: SeedCityId.YEKATERINBURG },
      { fromCityId: SeedCityId.CHELYABINSK, number: 5, tariffMinor: 9_400_000n, toCityId: SeedCityId.NOVOSIBIRSK },
      { fromCityId: SeedCityId.NOVOSIBIRSK, number: 6, tariffMinor: 900_000n, toCityId: SeedCityId.NOVOSIBIRSK },
    ],
    tenantId: SeedOrganizationId.CARRIER_2,
    vehicles: [
      {
        cityId: SeedCityId.CHELYABINSK,
        details: {
          bodyType: VehicleBodyType.LONG_HAUL,
          cargoKinds: [VehicleCargoKind.GENERAL, VehicleCargoKind.OVERSIZE],
          heightMillimeters: 2_600,
          lengthMillimeters: 13_600,
          palletPlaces: 33,
          payloadGrams: 22_000_000n,
          volumeCubicCentimeters: 86_000_000n,
          widthMillimeters: 2_480,
        },
        number: 4,
      },
      {
        cityId: SeedCityId.CHELYABINSK,
        details: {
          bodyType: VehicleBodyType.LOW_LOADER,
          cargoKinds: [VehicleCargoKind.OVERSIZE],
          heightMillimeters: 3_500,
          lengthMillimeters: 14_000,
          payloadGrams: 36_000_000n,
          volumeCubicCentimeters: 120_000_000n,
          widthMillimeters: 2_500,
        },
        number: 5,
      },
      {
        cityId: SeedCityId.NOVOSIBIRSK,
        details: {
          bodyType: VehicleBodyType.FLATBED,
          cargoKinds: [VehicleCargoKind.GENERAL],
          heightMillimeters: 2_400,
          lengthMillimeters: 8_000,
          palletPlaces: 18,
          payloadGrams: 10_000_000n,
          volumeCubicCentimeters: 46_000_000n,
          widthMillimeters: 2_450,
        },
        number: 6,
      },
    ],
  },
];

const seedFleetId = (prefix: string, number: number): string => `${prefix}${String(number).padStart(6, '0')}-0000-4000-8000-000000000000`;

export const createSeedFleetRecords = (worldStartMs: number): SeedFleetRecordsValue => ({
  carrierLanes: SEED_PARKS.flatMap(park => park.lanes.map(lane => create(CarrierLaneSchema, {
    departureWeekdays: [...WEEKDAYS],
    fromCityId: lane.fromCityId,
    id: seedFleetId('e3', lane.number),
    isActive: true,
    tariff: { amountMinor: lane.tariffMinor, currencyCode: 'RUB' },
    tenantId: park.tenantId,
    toCityId: lane.toCityId,
    version: 1n,
  }))),
  drivers: SEED_PARKS.flatMap(park => park.drivers.map(driver => create(DriverSchema, {
    displayName: driver.displayName,
    id: seedFleetId('e2', driver.number),
    isActive: true,
    tenantId: park.tenantId,
    version: 1n,
  }))),
  vehicles: SEED_PARKS.flatMap(park => park.vehicles.map(vehicle => create(VehicleSchema, {
    details: {
      ...vehicle.details,
      availability: [{
        cityId: vehicle.cityId,
        endsAt: timestampFromMs(worldStartMs + SEED_AVAILABILITY_MS),
        startsAt: timestampFromMs(worldStartMs),
      }],
      cargoKinds: [...(vehicle.details.cargoKinds ?? [])],
      registrationNumber: `А${String(vehicle.number).padStart(3, '0')}АА 000`,
    },
    id: seedFleetId('e1', vehicle.number),
    tenantId: park.tenantId,
    version: 1n,
  }))),
});
