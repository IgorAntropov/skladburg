import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createWarehouseTruckGeometry } from './useWarehouseTruckModel';
import {
  buildWarehouseCargoVisuals,
  WAREHOUSE_TRUCK_SLOTS,
} from './warehouseCargoPositions';
import { getWarehouseLayout } from './warehouseLayout';
import { WAREHOUSE_TRUCK_DECK_Y } from './warehouseTruckDimensions';
import { WAREHOUSE_TRUCK_CENTER_Z } from './warehouseYardRoads';

describe('warehouse truck model', () => {
  it('supports the full footprint of every loaded pallet in the open trailer', () => {
    const geometry = createWarehouseTruckGeometry();
    const material = new MeshBasicMaterial();
    const truck = new Mesh(geometry, material);
    const layout = getWarehouseLayout(create(WarehouseTopologySchema));
    const dock = { x: 6, z: 5 };
    const units = Array.from({ length: WAREHOUSE_TRUCK_SLOTS }, (_, truckSlot) => ({
      cellId: undefined,
      expectedUnitId: String(truckSlot),
      id: String(truckSlot),
      location: 'truck' as const,
      slot: truckSlot,
      taskId: 'visit',
      truckSlot,
    }));
    const pallets = buildWarehouseCargoVisuals(
      layout,
      { dockTaskId: 'visit', hasDock: true, units },
      undefined,
      undefined,
      undefined,
      dock,
    );
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));

    expect(pallets).toHaveLength(WAREHOUSE_TRUCK_SLOTS);
    for (const { point: [x, y, z], size } of pallets) {
      for (const dx of [-size / 2, size / 2]) {
        for (const dz of [-size / 2, size / 2]) {
          ray.ray.origin.set(x - dock.x + dx, y + 1, z - dock.z - WAREHOUSE_TRUCK_CENTER_Z + dz);
          const [hit] = ray.intersectObject(truck);

          expect(hit?.point.y).toBeCloseTo(WAREHOUSE_TRUCK_DECK_Y, 3);
          expect(y - (hit?.point.y ?? 0)).toBeLessThan(0.015);
        }
      }
    }

    material.dispose();
    geometry.dispose();
  });
});
