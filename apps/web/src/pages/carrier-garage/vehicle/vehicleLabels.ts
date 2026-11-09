import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';

import type { GarageTranslate } from '../i18n/garageSection';

type VehicleBodyLabelValue = Extract<Parameters<GarageTranslate>[0], `garage.vehicle.body.${string}`>;

type VehicleCargoLabelValue = Extract<Parameters<GarageTranslate>[0], `garage.vehicle.cargo.${string}`>;

export const VEHICLE_BODY_LABELS: Readonly<Partial<Record<VehicleBodyType, VehicleBodyLabelValue>>> = {
  [VehicleBodyType.CURTAIN_SIDE]: 'garage.vehicle.body.curtainSide',
  [VehicleBodyType.FLATBED]: 'garage.vehicle.body.flatbed',
  [VehicleBodyType.INSULATED]: 'garage.vehicle.body.insulated',
  [VehicleBodyType.LONG_HAUL]: 'garage.vehicle.body.longHaul',
  [VehicleBodyType.LOW_LOADER]: 'garage.vehicle.body.lowLoader',
  [VehicleBodyType.REFRIGERATED]: 'garage.vehicle.body.refrigerated',
};

export const VEHICLE_CARGO_LABELS: Readonly<Partial<Record<VehicleCargoKind, VehicleCargoLabelValue>>> = {
  [VehicleCargoKind.GENERAL]: 'garage.vehicle.cargo.general',
  [VehicleCargoKind.OVERSIZE]: 'garage.vehicle.cargo.oversize',
  [VehicleCargoKind.TEMPERATURE_CONTROLLED]: 'garage.vehicle.cargo.temperatureControlled',
};
