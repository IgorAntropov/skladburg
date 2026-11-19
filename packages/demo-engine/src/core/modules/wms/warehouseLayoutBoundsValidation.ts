import type {
  InitializeWarehouseLayoutRequest,
  WarehouseFloorRect,
} from '@skladburg/contracts/wms/v1/topology';

import type { ViolationValue } from '../../errors/domainErrors';

const LAYOUT_GRID_STEP_MM = 100;
const MIN_ZONE_WIDTH_MM = 1_200;
const MIN_ZONE_DEPTH_MM = 1_000;

export const collectWarehouseLayoutBoundsViolations = (
  { warehouseDepthMm, warehouseWidthMm }: InitializeWarehouseLayoutRequest,
  zoneBounds: WarehouseFloorRect,
): ViolationValue[] => {
  const { depthMm, origin, widthMm } = zoneBounds;
  if (origin === undefined) {
    return [{ fieldPath: 'zone_bounds.origin', ruleId: 'required' }];
  }

  const { xMm, zMm } = origin;
  const violations: ViolationValue[] = [];
  const gridFields = {
    'warehouse_depth_mm': warehouseDepthMm,
    'warehouse_width_mm': warehouseWidthMm,
    'zone_bounds.depth_mm': depthMm,
    'zone_bounds.origin.x_mm': xMm,
    'zone_bounds.origin.z_mm': zMm,
    'zone_bounds.width_mm': widthMm,
  };

  for (const [fieldPath, value] of Object.entries(gridFields)) {
    if (value % LAYOUT_GRID_STEP_MM !== 0) {
      violations.push({ fieldPath, ruleId: 'warehouse.layout_grid_step' });
    }
  }

  for (const [fieldPath, size, minimum, offset, limit] of [
    ['zone_bounds.width_mm', widthMm, MIN_ZONE_WIDTH_MM, xMm, warehouseWidthMm],
    ['zone_bounds.depth_mm', depthMm, MIN_ZONE_DEPTH_MM, zMm, warehouseDepthMm],
  ] as const) {
    if (size < minimum) {
      violations.push({ fieldPath, ruleId: 'warehouse.zone_min_size' });
    }
    else if (offset + size > limit) {
      violations.push({ fieldPath, ruleId: 'warehouse.zone_outside_warehouse' });
    }
  }

  return violations;
};
