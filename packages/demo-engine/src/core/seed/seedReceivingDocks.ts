import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import { WarehouseUnloadingPointSchema } from '@skladburg/contracts/wms/v1/topology';

import type { EngineSnapshotValue } from '../ports/index';

import { createDomainErrors } from '../errors/index';
import { assignAvailableInboundDocks } from '../modules/wms/inboundRecords';
import {
  encodeWarehouseTopology,
  readWarehouseTopology,
} from '../modules/wms/warehouseTopologyCodec';
import { readEffectiveWarehouseDockIds } from '../modules/wms/warehouseTopologyRecords';
import { createRandom } from '../ports/index';
import {
  createEngineState,
  TABLE_DEFINITIONS,
} from '../state/index';
import { SeedOrganizationId } from './seedIds';
import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from './seedWarehouseWorkspaceConfig';

const RECEIVING_AREA_ID = '8f000004-0000-4000-8000-000000000010';
const SECOND_DOCK_ID = '8f000004-0000-4000-8000-000000000012';
const SECOND_DOCK_POSITION = { xMm: 7_200, zMm: 0 };
const DOCK_APPROACH_HALF_WIDTH_MM = 1_250;
const DOCK_APPROACH_DEPTH_MM = 1_880;

const hasRackInApproach = (topology: WarehouseTopology): boolean => {
  const { xMm, zMm } = SECOND_DOCK_POSITION;
  return topology.storageZones.some(zone => zone.rows.some(row => row.racks.some(({ footprint }) => {
    const origin = footprint?.origin;
    return footprint !== undefined && origin !== undefined
      && origin.xMm <= xMm + DOCK_APPROACH_HALF_WIDTH_MM && origin.xMm + footprint.widthMm >= xMm - DOCK_APPROACH_HALF_WIDTH_MM
      && origin.zMm <= zMm + DOCK_APPROACH_DEPTH_MM && origin.zMm + footprint.depthMm >= zMm;
  })));
};

export const addSeedReceivingDock = (topology: WarehouseTopology): boolean => {
  const area = topology.receivingArea;
  if (area?.id !== RECEIVING_AREA_ID || area.footprint === undefined || area.additionalUnloadingPoints.length > 0) {
    return false;
  }
  const secondDock = create(WarehouseUnloadingPointSchema, {
    capabilities: [WarehouseCapability.COLD], code: 'D02', id: SECOND_DOCK_ID, position: SECOND_DOCK_POSITION,
  });
  if (readEffectiveWarehouseDockIds({ ...area, additionalUnloadingPoints: [secondDock] }).length < 2 || hasRackInApproach(topology)) {
    return false;
  }
  area.footprint.widthMm = Math.max(area.footprint.widthMm, 8_000);
  area.additionalUnloadingPoints.push(secondDock);
  return true;
};

export const prepareSeedReceivingDocks = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const warehouseId = SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID;
  const tenantId = SeedOrganizationId.CUSTOMER_1;
  const stored = snapshot.collections.warehouseTopologies.get(warehouseId);
  if (stored === undefined) {
    return snapshot;
  }
  const topology = readWarehouseTopology(TABLE_DEFINITIONS.warehouseTopologies.decode(stored));
  const area = topology.receivingArea;
  if (topology.tenantId !== tenantId || topology.warehouseId !== warehouseId || topology.revision >= 4_294_967_295
    || area?.id !== RECEIVING_AREA_ID) {
    return snapshot;
  }

  const hasAddedDock = addSeedReceivingDock(topology);
  const secondDock = area.additionalUnloadingPoints.find(dock => dock.id === SECOND_DOCK_ID);
  if (secondDock === undefined || (!hasAddedDock && secondDock.capabilities.length > 0)) {
    return snapshot;
  }
  secondDock.capabilities = [WarehouseCapability.COLD];
  topology.revision += 1;

  const errors = createDomainErrors(createRandom(snapshot.meta.traceRandomState));
  const { changeSet } = createEngineState(snapshot).transact(snapshot.meta.worldTimeMs, (transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    assignAvailableInboundDocks(transaction, { errors, outbox: { add: (): void => undefined } }, {
      receivingAreaId: RECEIVING_AREA_ID, tenantId, warehouseId,
    });
  }, () => snapshot.meta);
  const collections = { ...snapshot.collections };
  for (const name of ['warehouseTopologies', 'warehouseInbound'] as const) {
    collections[name] = new Map([...collections[name], ...(changeSet?.puts[name] ?? [])]);
  }
  return { ...snapshot, collections };
};
