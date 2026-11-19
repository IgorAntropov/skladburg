import type { YardWaitingReason } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  YardAdmissionStatus,
  YardPriorityFactor,
  YardWaitingReasonCode,
  YardWaitingReasonSchema,
} from '@skladburg/contracts/wms/v1/receiving';

import type { PermissionCallerValue } from '../../access/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { InboundDockCandidateValue } from './inboundDockSchedule';

import { isWarehouseInScope } from '../../access/index';
import { canUseInboundDock } from './inboundDockQueue';
import { isInboundDockSlotExpired } from './inboundDockSlots';
import {
  discardUnavailableInboundReservations,
  isReceivingTaskActive,
  MAX_RECEIVING_VERSION,
  readInboundDockCandidate,
  readInboundDocks,
  readInboundDockUsage,
  readInboundTask,
  readInboundWarehouseDate,
  readYardQueueWeights,
} from './inboundRecords';
import {
  isInboundYardBlocked,
  readInboundYardGate,
} from './inboundYardGate';
import { usesOutboundDock } from './outboundDockOccupancy';
import { readWarehouseReceivingLayoutOccupancy } from './warehouseReceivingLayoutOccupancy';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';
import {
  readYardDispatchVisitBlock,
  readYardDockAssignment,
  readYardPromotionBlock,
} from './yardDispatchAvailability';
import {
  rankYardQueue,
  scoreYardQueueCandidate,
} from './yardQueueScoring';

export const listInboundYardWaitingReasons = (
  { errors, getWorldTimeMs, read }: Pick<IModuleRuntime, 'errors' | 'getWorldTimeMs' | 'read'>,
  warehouseId: string,
  { admission, organizationId: tenantId, permissions }: PermissionCallerValue,
): YardWaitingReason[] => {
  const tasks = read.listBy('warehouseInbound', 'scopeId', warehouseId)
    .filter(record => record.lookupKey === tenantId)
    .map(record => readInboundTask(record, errors))
    .filter(task => task.version > 0);
  const topology = readOwnedWarehouseTopology(read, errors, warehouseId, tenantId);
  const area = topology?.receivingArea;
  const docks = area === undefined ? [] : readInboundDocks(read, errors, { receivingAreaId: area.id, tenantId, warehouseId });
  const canManage = admission.kind === 'membership'
    && permissions.some(permission => permission.permission === 'yard_manage' && isWarehouseInScope(permission, warehouseId));
  const occupiedDockIds = canManage && topology !== undefined && docks.length > 0
    ? readWarehouseReceivingLayoutOccupancy(read, topology, errors, false).occupiedDockIds
    : undefined;
  const worldTimeMs = getWorldTimeMs();
  const warehouseDate = readInboundWarehouseDate(read, warehouseId, worldTimeMs);
  const active = tasks.filter(isReceivingTaskActive).map(task => ({ gate: readInboundYardGate(read, task, tenantId), task }));
  const { occupied, reservations } = readInboundDockUsage(
    tasks.filter(task => task.receivingAreaId === area?.id), docks, area?.id ?? '', worldTimeMs,
  );
  discardUnavailableInboundReservations(read, tenantId, docks, reservations, worldTimeMs, warehouseDate);
  const weights = readYardQueueWeights(read, tenantId);
  const primary = docks[0];
  const hasDispatchConstraints = reservations.size > 0 || active.some(({ gate, task }) =>
    task.receivingAreaId === area?.id && !isInboundYardBlocked(gate)
    && (task.dockSchedule !== undefined || read.get('warehouseInbound', task.id)?.manualPrioritySequence !== undefined
      || gate === YardAdmissionStatus.ADMITTED));
  if (primary !== undefined && hasDispatchConstraints && usesOutboundDock(read, tenantId, warehouseId, errors)) {
    occupied.set(primary.id, undefined);
  }

  const reasons: YardWaitingReason[] = [];
  const candidates: InboundDockCandidateValue[] = [];
  for (const { gate, task } of active) {
    const row = { dispatchOptions: canManage ? {} : undefined, receivingTaskId: task.id, taskVersion: task.version };
    if (isInboundYardBlocked(gate)) {
      reasons.push(create(YardWaitingReasonSchema, {
        ...row,
        reason: gate === YardAdmissionStatus.PASS_REJECTED ? YardWaitingReasonCode.PASS_REJECTED : YardWaitingReasonCode.WAITING_DOCUMENTS,
      }));
      continue;
    }
    const isInCurrentArea = task.receivingAreaId === area?.id;
    const areaDocks = isInCurrentArea ? docks : [];
    if (areaDocks.some(dock => dock.id === task.unloadingPointId)) {
      continue;
    }
    const candidate = readInboundDockCandidate(read, task, tenantId, areaDocks.length, warehouseDate);
    const compatible = areaDocks.filter(dock => canUseInboundDock(dock, candidate));
    const slot = reservations.get(task);
    const hasValidSlot = slot !== undefined && !isInboundDockSlotExpired(slot, worldTimeMs)
      && compatible.some(dock => dock.id === slot.dockId);
    const hasNoCompatibleDock = isInCurrentArea && (areaDocks.length > 0 || task.dockSchedule !== undefined) && compatible.length === 0;
    const isBusy = compatible.length > 0 && compatible.every(({ id }) => occupied.has(id)
      || [...reservations].some(([owner, booked]) => owner !== task && booked.dockId === id
        && booked.startsAtMs <= worldTimeMs && worldTimeMs < booked.endsAtMs));
    const canAct = isInCurrentArea && task.version < MAX_RECEIVING_VERSION && readYardDispatchVisitBlock(task, gate) === undefined;
    if ((!canAct || compatible.length === 0) && !hasNoCompatibleDock && !isBusy && task.dockSchedule === undefined
      && task.yardAdmissionStatus !== YardAdmissionStatus.WAITING_DOCK && areaDocks.length <= 1) {
      continue;
    }
    let reason = YardWaitingReasonCode.WAITING_ASSIGNMENT;
    if (hasNoCompatibleDock) {
      reason = YardWaitingReasonCode.NO_COMPATIBLE_DOCK;
    }
    else if (hasValidSlot && worldTimeMs < slot.startsAtMs) {
      reason = YardWaitingReasonCode.WAITING_SLOT;
    }
    else if (hasValidSlot && occupied.has(slot.dockId)) {
      reason = YardWaitingReasonCode.BOOKED_DOCK_BUSY;
    }
    else if (isBusy) {
      reason = YardWaitingReasonCode.DOCKS_BUSY;
    }
    const priorityFactors = compatible.length === 0 || task.version >= MAX_RECEIVING_VERSION
      ? []
      : scoreYardQueueCandidate(candidate, weights, worldTimeMs, warehouseDate, false).reasonCodes.map(code => YardPriorityFactor[code]);
    if (compatible.length > 0 && !hasValidSlot && task.version < MAX_RECEIVING_VERSION) {
      candidates.push(candidate);
    }
    const dispatchOptions = occupiedDockIds !== undefined && canAct
      ? {
          assignableUnloadingPointIds: compatible
            .filter(({ id }) => readYardDockAssignment({
              candidate, docks, occupiedDockIds, reservations, worldTimeMs,
            }, id).kind === 'available')
            .map(({ id }) => id),
          canPromote: readYardPromotionBlock(candidate, docks, slot) === undefined,
        }
      : row.dispatchOptions;
    reasons.push(create(YardWaitingReasonSchema, { ...row, dispatchOptions, priorityFactors, reason }));
  }

  const queue = rankYardQueue(candidates, weights, worldTimeMs, warehouseDate);
  const positions = new Map(queue.map(({ id }, index) => [id, index + 1]));
  for (const row of reasons) {
    row.queuePosition = positions.get(row.receivingTaskId);
  }
  return reasons;
};
