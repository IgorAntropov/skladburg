import type { YardWaitingReason } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  YardAdmissionStatus,
  YardPriorityFactor,
  YardWaitingReasonCode,
  YardWaitingReasonSchema,
} from '@skladburg/contracts/wms/v1/receiving';

import type { IModuleRuntime } from '../moduleRuntime';

import { canUseInboundDock } from './inboundDockQueue';
import { isInboundDockSlotExpired } from './inboundDockSlots';
import {
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
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';
import { scoreYardQueueCandidate } from './yardQueueScoring';

export const listInboundYardWaitingReasons = (
  { errors, getWorldTimeMs, read }: Pick<IModuleRuntime, 'errors' | 'getWorldTimeMs' | 'read'>,
  warehouseId: string,
  tenantId: string,
): YardWaitingReason[] => {
  const tasks = read.listBy('warehouseInbound', 'scopeId', warehouseId)
    .filter(record => record.lookupKey === tenantId)
    .map(record => readInboundTask(record, errors))
    .filter(task => task.version > 0);
  const area = readOwnedWarehouseTopology(read, errors, warehouseId, tenantId)?.receivingArea;
  const docks = area === undefined ? [] : readInboundDocks(read, errors, { receivingAreaId: area.id, tenantId, warehouseId });
  const worldTimeMs = getWorldTimeMs();
  const warehouseDate = readInboundWarehouseDate(read, warehouseId, worldTimeMs);
  const { occupied, reservations } = readInboundDockUsage(
    tasks.filter(task => task.receivingAreaId === area?.id), docks, area?.id ?? '', worldTimeMs,
  );
  for (const [owner, slot] of reservations) {
    if (!isReceivingTaskActive(owner) || owner.version >= MAX_RECEIVING_VERSION || docks.some(dock => dock.id === owner.unloadingPointId)) {
      continue;
    }
    const ownerCandidate = readInboundDockCandidate(read, owner, tenantId, docks.length, warehouseDate);
    if (isInboundDockSlotExpired(slot, worldTimeMs) || isInboundYardBlocked(readInboundYardGate(read, owner, tenantId))
      || !docks.some(dock => dock.id === slot.dockId && canUseInboundDock(dock, ownerCandidate))) {
      reservations.delete(owner);
    }
  }
  const weights = readYardQueueWeights(read, tenantId);
  const primary = docks[0];
  const hasSchedules = reservations.size > 0 || tasks.some(task => task.dockSchedule !== undefined
    && task.receivingAreaId === area?.id && isReceivingTaskActive(task)
    && !isInboundYardBlocked(readInboundYardGate(read, task, tenantId)));
  if (primary !== undefined && hasSchedules && usesOutboundDock(read, tenantId, warehouseId, errors)) {
    occupied.set(primary.id, undefined);
  }

  const reasons: YardWaitingReason[] = [];
  for (const task of tasks) {
    if (!isReceivingTaskActive(task)) {
      continue;
    }
    const gate = readInboundYardGate(read, task, tenantId);
    const row = { receivingTaskId: task.id, taskVersion: task.version };
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
    if (!hasNoCompatibleDock && !isBusy && task.dockSchedule === undefined
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
    reasons.push(create(YardWaitingReasonSchema, { ...row, priorityFactors, reason }));
  }

  return reasons;
};
