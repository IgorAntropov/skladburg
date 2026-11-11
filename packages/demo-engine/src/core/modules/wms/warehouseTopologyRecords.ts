import type {
  WarehouseFloorRect,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import {
  WarehouseChange,
  WarehouseChangedSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { warehouseChannel } from '@skladburg/contracts/runtime';

import type { IDomainErrors } from '../../errors/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { WarehouseTopologyRecordValue } from '../../state/records';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  encodeWarehouseTopology,
  readWarehouseTopology,
} from './warehouseTopologyCodec';

export { readWarehouseTopology } from './warehouseTopologyCodec';

const addUnique = (seen: Set<string>, key: string): void => {
  if (seen.has(key)) {
    throw new Error('Warehouse topology contains a duplicate identifier or cell code');
  }

  seen.add(key);
};

const getFootprintWidth = (footprint: undefined | WarehouseFloorRect): number => {
  if (footprint === undefined || footprint.widthMm <= 0 || footprint.depthMm <= 0) {
    throw new Error('Warehouse footprint requires positive dimensions');
  }

  return footprint.widthMm;
};

const checkTopology = (topology: WarehouseTopology): void => {
  const ids = new Set<string>();
  const cellCodes = new Set<string>();
  const receiving = topology.receivingArea;

  if (receiving !== undefined) {
    addUnique(ids, receiving.id);
    getFootprintWidth(receiving.footprint);

    if (receiving.unloadingPoint !== undefined) {
      addUnique(ids, receiving.unloadingPoint.id);
    }
  }

  for (const zone of topology.storageZones) {
    addUnique(ids, zone.id);

    for (const row of zone.rows) {
      addUnique(ids, row.id);

      for (const rack of row.racks) {
        addUnique(ids, rack.id);
        const rackWidth = getFootprintWidth(rack.footprint);

        for (const tier of rack.tiers) {
          addUnique(ids, tier.id);
          let end = 0;
          const cells = tier.cells.toSorted((current, prev) => current.xOffsetMm - prev.xOffsetMm);

          for (const cell of cells) {
            addUnique(ids, cell.id);
            addUnique(cellCodes, cell.code);

            if (cell.widthMm <= 0 || cell.xOffsetMm < end || cell.xOffsetMm + cell.widthMm > rackWidth) {
              throw new Error('Warehouse cell overlaps another cell or exceeds the rack width');
            }

            end = cell.xOffsetMm + cell.widthMm;
          }
        }
      }
    }
  }
};

export const createWarehouseTopologyRecord = (topology: WarehouseTopology): WarehouseTopologyRecordValue => {
  checkTopology(topology);

  return encodeWarehouseTopology(topology);
};

export const readOwnedWarehouseTopology = (
  reader: IStateReader,
  errors: IDomainErrors,
  warehouseId: string,
  tenantId: string,
): undefined | WarehouseTopology => {
  const record = reader.get('warehouseTopologies', warehouseId);

  if (record === undefined) {
    return undefined;
  }

  const topology = readWarehouseTopology(record);

  if (topology.warehouseId !== warehouseId || topology.tenantId !== tenantId) {
    throw errors.internal();
  }

  return topology;
};

export const saveWarehouseTopology = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  topology: WarehouseTopology,
): void => {
  transaction.put('warehouseTopologies', createWarehouseTopologyRecord(topology));
  runtime.outbox.add(transaction, warehouseChannel(topology.warehouseId), {
    case: 'warehouseChanged',
    value: create(WarehouseChangedSchema, { change: WarehouseChange.TOPOLOGY_UPDATED, warehouseId: topology.warehouseId }),
  });
};
