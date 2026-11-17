import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import {
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';

import type {
  WarehouseActiveVisitPhaseValue,
  WarehouseDockVisitValue,
  WarehouseYardVisitValue,
} from './warehouseSceneCargo';

export const isWarehouseVisitActive = (visit: undefined | WarehouseYardVisitValue): visit is WarehouseDockVisitValue & {
  phase: WarehouseActiveVisitPhaseValue;
} => visit !== undefined && !('departure' in visit) && visit.phase !== 'awaiting-shipment'
  && visit.phase !== 'cancelled' && visit.phase !== 'pass-rejected';

export const projectInboundYardVisit = (task: ReceivingTask, tripId: string | undefined): undefined | WarehouseYardVisitValue => {
  const { id: taskId, receivedUnits, status, unloadingPointId, yardAdmissionStatus } = task;
  const visit = { taskId, tripId, unloadingPointId };
  if (status === ReceivingTaskStatus.READY_FOR_RECONCILIATION || status === ReceivingTaskStatus.RECONCILED) {
    return { ...visit, departure: 'received', phase: 'released' };
  }
  if (status === ReceivingTaskStatus.OPEN || status === ReceivingTaskStatus.IN_PROGRESS) {
    if (yardAdmissionStatus === YardAdmissionStatus.PASS_REJECTED) {
      return { ...visit, phase: 'pass-rejected' };
    }
    if (yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCUMENTS) {
      return { ...visit, isWaitingInYard: true, phase: 'waiting-documents', unloadingPointId: undefined };
    }
    if (yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK) {
      return { ...visit, isWaitingInYard: true, phase: 'queued', unloadingPointId: undefined };
    }
    const phase = receivedUnits.length > 0 ? 'unloading' : unloadingPointId === undefined ? 'queued' : 'assigned';
    return { ...visit, phase };
  }
  return undefined;
};

export const projectOutboundYardVisit = (task: PickingTask, trip: Trip | undefined): undefined | WarehouseYardVisitValue => {
  const visit = { isOutbound: true, taskId: task.id, tripId: trip?.id };
  if (trip?.status === TripStatus.CANCELLED || task.status === PickingTaskStatus.CANCELLED) {
    return { ...visit, phase: 'cancelled' };
  }

  const isShipped = task.status === PickingTaskStatus.SHIPPED;
  if (!isShipped && task.status !== PickingTaskStatus.PICKED) {
    return undefined;
  }
  if (trip === undefined) {
    return isShipped ? { ...visit, departure: 'self-pickup', phase: 'departed' } : { ...visit, phase: 'awaiting-load' };
  }

  const hasDeparted = trip.status === TripStatus.IN_TRANSIT || trip.status === TripStatus.ARRIVED
    || trip.status === TripStatus.DELIVERED || trip.status === TripStatus.CLOSED;
  if (hasDeparted) {
    return isShipped ? { ...visit, departure: 'route', phase: 'departed' } : { ...visit, phase: 'awaiting-shipment' };
  }
  if (trip.status === TripStatus.ASSIGNED || trip.status === TripStatus.LOADED) {
    return { ...visit, phase: isShipped ? 'loaded' : 'awaiting-load' };
  }
  return undefined;
};
