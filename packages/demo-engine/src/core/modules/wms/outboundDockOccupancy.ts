import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import { readTripForDeal } from '../logistics/tripRecords';
import { readOutboundTask } from './outboundRecords';

export const usesOutboundDock = (read: IStateReader, tenantId: string, warehouseId: string, errors: IDomainErrors): boolean =>
  read.listBy('warehouseOutbound', 'scopeId', warehouseId).some((record) => {
    if (record.lookupKey !== tenantId) {
      return false;
    }
    const { dealId, status } = readOutboundTask(record, errors);
    if (status !== PickingTaskStatus.PICKED && status !== PickingTaskStatus.SHIPPED) {
      return false;
    }
    const trip = readTripForDeal(read, dealId);
    if (trip === undefined) {
      return status === PickingTaskStatus.PICKED;
    }

    return trip.transportOrder?.pickup?.warehouseId === warehouseId
      && (trip.status === TripStatus.ASSIGNED || trip.status === TripStatus.LOADED);
  });
