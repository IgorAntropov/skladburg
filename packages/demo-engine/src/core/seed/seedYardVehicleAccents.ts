import { YardVehicleAccent } from '@skladburg/contracts/wms/v1/receiving';

import { SeedOrganizationId } from './seedIds';

export const SEED_YARD_VEHICLE_ACCENTS: ReadonlyMap<string, YardVehicleAccent> = new Map([
  [SeedOrganizationId.CARRIER_1, YardVehicleAccent.BLUE],
  [SeedOrganizationId.CARRIER_2, YardVehicleAccent.OCHRE],
  [SeedOrganizationId.CUSTOMER_1, YardVehicleAccent.GREEN],
  [SeedOrganizationId.CUSTOMER_2, YardVehicleAccent.SLATE],
  [SeedOrganizationId.SUPPLIER_1, YardVehicleAccent.TERRACOTTA],
  [SeedOrganizationId.SUPPLIER_4, YardVehicleAccent.SLATE],
]);
