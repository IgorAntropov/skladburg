import type {
  CarrierLane,
  Driver,
  Vehicle,
} from '@skladburg/contracts/fleet/v1/fleet';

import type { FleetPageReader } from './useFleetList';

export const fetchVehicles: FleetPageReader<Vehicle> = async (client, page, signal) => {
  const response = await client.listVehicles({ page }, { signal });

  return { items: response.vehicles, nextPageToken: response.page?.nextPageToken ?? '' };
};

export const fetchDrivers: FleetPageReader<Driver> = async (client, page, signal) => {
  const response = await client.listDrivers({ page }, { signal });

  return { items: response.drivers, nextPageToken: response.page?.nextPageToken ?? '' };
};

export const fetchCarrierLanes: FleetPageReader<CarrierLane> = async (client, page, signal) => {
  const response = await client.listCarrierLanes({ page }, { signal });

  return { items: response.carrierLanes, nextPageToken: response.page?.nextPageToken ?? '' };
};
