import { SEED_WORLD_START_MS } from './seedConfig';
import {
  SeedOrganizationId,
  SeedWarehouseId,
} from './seedIds';

export const WAREHOUSE_SENSOR_INTERVAL_MS = 60_000;

export const WAREHOUSE_SENSOR_SITE = {
  installedAtMs: SEED_WORLD_START_MS,
  tenantId: SeedOrganizationId.CUSTOMER_1,
  warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
  zoneId: '8f000004-0000-4000-8000-000000000001',
} as const;
