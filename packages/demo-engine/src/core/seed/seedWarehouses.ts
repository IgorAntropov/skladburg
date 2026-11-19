import { create } from '@bufbuild/protobuf';
import {
  type Warehouse,
  WarehouseCapability,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';

import {
  SeedCityId,
  SeedMapNodeId,
  SeedOrganizationId,
  SeedWarehouseId,
} from './seedIds';
import {
  MOSCOW_TIME_ZONE,
  NOVOSIBIRSK_TIME_ZONE,
  YEKATERINBURG_TIME_ZONE,
} from './seedNetwork';

type SeedWarehouseCityValue = keyof typeof SeedCityId;

interface SeedWarehouseDefinitionValue {
  capabilities?: readonly WarehouseCapability[] | undefined;
  city: SeedWarehouseCityValue;
  id: string;
  name?: string | undefined;
  tenantId: string;
  timeZone?: string | undefined;
}

const RAMP_AND_COLD = [WarehouseCapability.RAMP, WarehouseCapability.COLD] as const;

const SEED_WAREHOUSE_DEFINITIONS: readonly SeedWarehouseDefinitionValue[] = [
  {
    city: 'MOSCOW',
    id: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    tenantId: SeedOrganizationId.CUSTOMER_1,
  },
  {
    capabilities: [WarehouseCapability.RAMP],
    city: 'SAINT_PETERSBURG',
    id: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2,
    name: 'Склад 2',
    tenantId: SeedOrganizationId.CUSTOMER_1,
  },
  {
    capabilities: [WarehouseCapability.COLD],
    city: 'KAZAN',
    id: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
    name: 'Склад 3',
    tenantId: SeedOrganizationId.CUSTOMER_1,
  },
  {
    city: 'KRASNODAR',
    id: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    tenantId: SeedOrganizationId.SUPPLIER_1,
  },
  {
    city: 'KRASNODAR',
    id: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2,
    name: 'Склад 2',
    tenantId: SeedOrganizationId.SUPPLIER_1,
  },
  {
    city: 'VORONEZH',
    id: SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1,
    tenantId: SeedOrganizationId.SUPPLIER_2,
  },
  {
    capabilities: [WarehouseCapability.RAMP],
    city: 'KRASNODAR',
    id: SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1,
    tenantId: SeedOrganizationId.SUPPLIER_5,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE],
    city: 'YEKATERINBURG',
    id: SeedWarehouseId.CUSTOMER_2_SITE_1,
    name: 'Площадка 1',
    tenantId: SeedOrganizationId.CUSTOMER_2,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.OVERSIZE],
    city: 'NOVOSIBIRSK',
    id: SeedWarehouseId.CUSTOMER_2_SITE_2,
    name: 'Площадка 2',
    tenantId: SeedOrganizationId.CUSTOMER_2,
    timeZone: NOVOSIBIRSK_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE],
    city: 'CHELYABINSK',
    id: SeedWarehouseId.SUPPLIER_3_WAREHOUSE_1,
    tenantId: SeedOrganizationId.SUPPLIER_3,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE],
    city: 'NIZHNY_NOVGOROD',
    id: SeedWarehouseId.SUPPLIER_4_WAREHOUSE_1,
    tenantId: SeedOrganizationId.SUPPLIER_4,
  },
  {
    city: 'MOSCOW',
    id: SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1,
    tenantId: SeedOrganizationId.SUPPLIER_6,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE],
    city: 'NOVOSIBIRSK',
    id: SeedWarehouseId.SUPPLIER_7_WAREHOUSE_1,
    tenantId: SeedOrganizationId.SUPPLIER_7,
    timeZone: NOVOSIBIRSK_TIME_ZONE,
  },
];

export const createSeedWarehouses = (): Warehouse[] => SEED_WAREHOUSE_DEFINITIONS.map(definition => create(WarehouseSchema, {
  capabilities: [...(definition.capabilities ?? RAMP_AND_COLD)],
  cityId: SeedCityId[definition.city],
  id: definition.id,
  isWmsEnabled: true,
  mapNodeId: SeedMapNodeId[definition.city],
  name: definition.name ?? 'Склад 1',
  tenantId: definition.tenantId,
  timeZone: definition.timeZone ?? MOSCOW_TIME_ZONE,
}));
