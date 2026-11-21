import { create } from '@bufbuild/protobuf';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WarehouseEquipmentRecordSchema } from '@skladburg/contracts/wms/v1/warehouse_equipment_records';

import type { EngineSnapshotValue } from '../ports/index';
import type { WarehouseStockRecordValue } from '../state/records';

import {
  type DemoScenarioValue,
  WAREHOUSE_YARD_MORNING,
} from '../../protocol/demoScenario';
import { encodeWarehouseEquipmentRecord } from '../modules/wms/warehouseEquipmentRecords';
import { TABLE_DEFINITIONS } from '../state/tables';
import {
  SeedOrganizationId,
  SeedWarehouseId,
} from './seedIds';

const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const tenantId = SeedOrganizationId.CUSTOMER_1;

export const createSeedWarehouseEquipment = (worldTimeMs: number, scenario: DemoScenarioValue | undefined): WarehouseStockRecordValue => {
  const firstBattery = scenario === WAREHOUSE_YARD_MORNING ? 18 : 20;
  return encodeWarehouseEquipmentRecord(create(WarehouseEquipmentRecordSchema, {
    equipment: [
      { batteryPercent: firstBattery, code: 'ПГ-01', id: '8e000001-0000-4000-8000-000000000001' },
      { batteryPercent: 85, code: 'ПГ-02', id: '8e000001-0000-4000-8000-000000000002' },
    ].map(unit => ({
      unit: {
        ...unit,
        capacityKg: 2_000,
        kind: WarehouseEquipmentKind.FORKLIFT,
        liftHeightMm: 4_500,
        model: 'Складовой ЭП-20',
        status: WarehouseEquipmentStatus.AVAILABLE,
      },
      updatedAtMs: BigInt(worldTimeMs),
    })),
    stations: [{ code: 'ЗС-01', id: '8e000002-0000-4000-8000-000000000001' }],
    tenantId,
    warehouseId,
  }));
};

export const addSeedWarehouseEquipment = (snapshot: EngineSnapshotValue, scenario: DemoScenarioValue | undefined): EngineSnapshotValue => {
  const { collections } = snapshot;
  const warehouseEquipment = new Map(collections.warehouseEquipment);
  const stored = collections.warehouses.get(warehouseId);
  if (!warehouseEquipment.has(warehouseId) && stored !== undefined) {
    const warehouse = TABLE_DEFINITIONS.warehouses.decode(stored);
    if (warehouse.id === warehouseId && warehouse.tenantId === tenantId) {
      const equipment = createSeedWarehouseEquipment(snapshot.meta.worldTimeMs, scenario);
      warehouseEquipment.set(warehouseId, TABLE_DEFINITIONS.warehouseEquipment.encode(equipment));
    }
  }
  return { ...snapshot, collections: { ...collections, warehouseEquipment } };
};
