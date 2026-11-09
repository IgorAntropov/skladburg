import type { ServiceImpl } from '@connectrpc/connect';
import type { FleetService } from '@skladburg/contracts/fleet/v1/fleet';

import type { IModuleRuntime } from '../modules/index';

export const createDeferredFleetService = (runtime: IModuleRuntime): ServiceImpl<typeof FleetService> => {
  const service = (): Promise<ServiceImpl<typeof FleetService>> =>
    import('../modules/fleet/index').then(module => module.createFleetService(runtime));

  return {
    listCarrierLanes: async (request, context) => (await service()).listCarrierLanes(request, context),
    listDrivers: async (request, context) => (await service()).listDrivers(request, context),
    listVehicles: async (request, context) => (await service()).listVehicles(request, context),
    saveCarrierLane: async (request, context) => (await service()).saveCarrierLane(request, context),
    saveDriver: async (request, context) => (await service()).saveDriver(request, context),
    saveVehicle: async (request, context) => (await service()).saveVehicle(request, context),
  };
};
