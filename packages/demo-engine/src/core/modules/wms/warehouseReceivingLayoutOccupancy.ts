import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import {
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import { readInboundTask } from './inboundRecords';
import { usesOutboundDock } from './outboundDockOccupancy';
import { readStockBalance } from './stockRecords';
import { readEffectiveWarehouseDocks } from './warehouseTopologyRecords';

interface WarehouseReceivingLayoutOccupancyValue {
  hasStagedStock: boolean;
  hasWaitingTrucks: boolean;
  occupiedDockIds: ReadonlySet<string>;
}

export const readWarehouseReceivingLayoutOccupancy = (
  read: IStateReader,
  topology: WarehouseTopology,
  errors: IDomainErrors,
  shouldCheckStock: boolean,
): WarehouseReceivingLayoutOccupancyValue => {
  const { receivingArea, tenantId, warehouseId } = topology;
  const occupiedDockIds = new Set<string>();
  let hasWaitingTrucks = false;
  if (receivingArea === undefined) {
    return { hasStagedStock: false, hasWaitingTrucks, occupiedDockIds };
  }
  const docks = readEffectiveWarehouseDocks(receivingArea);
  const primary = docks[0];
  for (const record of read.listBy('warehouseInbound', 'scopeId', warehouseId)) {
    if (record.lookupKey !== tenantId) {
      continue;
    }
    const task = readInboundTask(record, errors);
    const isActive = task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS;
    if (!isActive || task.receivingAreaId !== receivingArea.id) {
      continue;
    }
    if (task.unloadingPointId !== undefined && docks.some(dock => dock.id === task.unloadingPointId)) {
      occupiedDockIds.add(task.unloadingPointId);
    }
    else if (primary !== undefined && docks.length === 1 && task.receivedUnits.length > 0) {
      occupiedDockIds.add(primary.id);
    }
    else if (task.yardAdmissionStatus !== YardAdmissionStatus.PASS_REJECTED) {
      hasWaitingTrucks = true;
    }
  }
  if (primary !== undefined && usesOutboundDock(read, tenantId, warehouseId, errors)) {
    occupiedDockIds.add(primary.id);
  }
  const hasStagedStock = shouldCheckStock && read.listBy('stockBalances', 'scopeId', warehouseId).some((record) => {
    const balance = readStockBalance(record, tenantId, errors);
    return balance.receivingAreaId === receivingArea.id && balance.lines.some(line => line.quantityBase > 0n);
  });

  return { hasStagedStock, hasWaitingTrucks, occupiedDockIds };
};
