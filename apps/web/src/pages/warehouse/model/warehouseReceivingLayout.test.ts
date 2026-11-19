import { create } from '@bufbuild/protobuf';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createReceivingLayoutDefaults,
  createReceivingLayoutGeometry,
} from './warehouseReceivingLayout';

const legacyTopology = create(WarehouseTopologySchema, {
  receivingArea: {
    footprint: { depthMm: 1_931, origin: { xMm: 12, zMm: 57 }, widthMm: 4_070 },
    unloadingPoint: { id: 'legacy-dock', position: { xMm: 1_259, zMm: 57 } },
  },
});

describe('warehouse receiving layout form', () => {
  it('preserves existing off-grid geometry and displays an inherited cold capability', () => {
    const result = createReceivingLayoutDefaults(legacyTopology, [WarehouseCapability.RAMP, WarehouseCapability.COLD]);

    expect(result.values.receivingFootprint).toEqual({ depthMm: '1931', origin: { xMm: '12', zMm: '57' }, widthMm: '4070' });
    expect(result.values.docks[0]).toEqual({ hasCold: true, hasOversize: false, xMm: '1259' });
  });

  it('leaves an existing inherited capability implicit when a new dock is added', () => {
    const defaults = createReceivingLayoutDefaults(legacyTopology, [WarehouseCapability.RAMP, WarehouseCapability.COLD]);
    const command = createReceivingLayoutGeometry(defaults, {
      dockCount: 2,
      docks: [{ hasCold: true, hasOversize: false, xMm: 1_259 }, { hasCold: false, hasOversize: true, xMm: 4_000 }],
      receivingFootprint: { depthMm: 1_931, origin: { xMm: 12, zMm: 57 }, widthMm: 4_070 },
    });

    expect(command.docks).toEqual([
      { capabilities: [], unloadingPointId: 'legacy-dock', xMm: 1_259 },
      { capabilities: [WarehouseCapability.RAMP, WarehouseCapability.OVERSIZE], xMm: 4_000 },
    ]);
  });

  it('sends an explicit ramp when the inherited cold capability is removed', () => {
    const defaults = createReceivingLayoutDefaults(legacyTopology, [WarehouseCapability.RAMP, WarehouseCapability.COLD]);
    const command = createReceivingLayoutGeometry(defaults, {
      dockCount: 1,
      docks: [{ hasCold: false, hasOversize: false, xMm: 1_259 }],
      receivingFootprint: { depthMm: 1_931, origin: { xMm: 12, zMm: 57 }, widthMm: 4_070 },
    });

    expect(command.docks).toEqual([{ capabilities: [WarehouseCapability.RAMP], unloadingPointId: 'legacy-dock', xMm: 1_259 }]);
  });
});
