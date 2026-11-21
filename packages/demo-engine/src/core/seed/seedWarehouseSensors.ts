import { WarehouseSensorChannelKind } from '@skladburg/contracts/wms/v1/warehouse_sensors';

import { SEED_WORLD_START_MS } from './seedConfig';
import {
  SeedOrganizationId,
  SeedWarehouseId,
} from './seedIds';

export const SEED_WAREHOUSE_SENSORS = [{
  channels: [
    { id: '8e000003-0000-4000-8000-000000000002', kind: WarehouseSensorChannelKind.TEMPERATURE },
    { id: '8e000003-0000-4000-8000-000000000003', kind: WarehouseSensorChannelKind.HUMIDITY },
    { id: '8e000003-0000-4000-8000-000000000004', kind: WarehouseSensorChannelKind.DOOR },
    { id: '8e000003-0000-4000-8000-000000000005', kind: WarehouseSensorChannelKind.CO2 },
  ],
  code: 'КЛ-01',
  id: '8e000003-0000-4000-8000-000000000001',
  installedAtMs: SEED_WORLD_START_MS,
  tenantId: SeedOrganizationId.CUSTOMER_1,
  warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
  zoneId: '8f000004-0000-4000-8000-000000000001',
}] as const;
