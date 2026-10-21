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

interface SeedWarehouseDefinitionValue {
  capabilities: readonly WarehouseCapability[];
  cityId: string;
  id: string;
  mapNodeId: string;
  name: string;
  tenantId: string;
  timeZone: string;
}

const SEED_WAREHOUSE_DEFINITIONS: readonly SeedWarehouseDefinitionValue[] = [
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD],
    cityId: SeedCityId.MOSCOW,
    id: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    mapNodeId: SeedMapNodeId.MOSCOW,
    name: 'Склад 1',
    tenantId: SeedOrganizationId.CUSTOMER_1,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP],
    cityId: SeedCityId.SAINT_PETERSBURG,
    id: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2,
    mapNodeId: SeedMapNodeId.SAINT_PETERSBURG,
    name: 'Склад 2',
    tenantId: SeedOrganizationId.CUSTOMER_1,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.COLD],
    cityId: SeedCityId.KAZAN,
    id: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
    mapNodeId: SeedMapNodeId.KAZAN,
    name: 'Склад 3',
    tenantId: SeedOrganizationId.CUSTOMER_1,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD],
    cityId: SeedCityId.KRASNODAR,
    id: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    mapNodeId: SeedMapNodeId.KRASNODAR,
    name: 'Склад 1',
    tenantId: SeedOrganizationId.SUPPLIER_1,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD],
    cityId: SeedCityId.VORONEZH,
    id: SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1,
    mapNodeId: SeedMapNodeId.VORONEZH,
    name: 'Склад 1',
    tenantId: SeedOrganizationId.SUPPLIER_2,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP],
    cityId: SeedCityId.KRASNODAR,
    id: SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1,
    mapNodeId: SeedMapNodeId.KRASNODAR,
    name: 'Склад 1',
    tenantId: SeedOrganizationId.SUPPLIER_5,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE],
    cityId: SeedCityId.YEKATERINBURG,
    id: SeedWarehouseId.CUSTOMER_2_SITE_1,
    mapNodeId: SeedMapNodeId.YEKATERINBURG,
    name: 'Площадка 1',
    tenantId: SeedOrganizationId.CUSTOMER_2,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.OVERSIZE],
    cityId: SeedCityId.NOVOSIBIRSK,
    id: SeedWarehouseId.CUSTOMER_2_SITE_2,
    mapNodeId: SeedMapNodeId.NOVOSIBIRSK,
    name: 'Площадка 2',
    tenantId: SeedOrganizationId.CUSTOMER_2,
    timeZone: NOVOSIBIRSK_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE],
    cityId: SeedCityId.CHELYABINSK,
    id: SeedWarehouseId.SUPPLIER_3_WAREHOUSE_1,
    mapNodeId: SeedMapNodeId.CHELYABINSK,
    name: 'Склад 1',
    tenantId: SeedOrganizationId.SUPPLIER_3,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE],
    cityId: SeedCityId.NIZHNY_NOVGOROD,
    id: SeedWarehouseId.SUPPLIER_4_WAREHOUSE_1,
    mapNodeId: SeedMapNodeId.NIZHNY_NOVGOROD,
    name: 'Склад 1',
    tenantId: SeedOrganizationId.SUPPLIER_4,
    timeZone: MOSCOW_TIME_ZONE,
  },
];

export const createSeedWarehouses = (): Warehouse[] => SEED_WAREHOUSE_DEFINITIONS.map(definition => create(WarehouseSchema, {
  address: '',
  capabilities: [...definition.capabilities],
  cityId: definition.cityId,
  id: definition.id,
  isWmsEnabled: true,
  mapNodeId: definition.mapNodeId,
  name: definition.name,
  tenantId: definition.tenantId,
  timeZone: definition.timeZone,
}));
