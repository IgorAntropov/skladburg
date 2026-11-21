import { create } from '@bufbuild/protobuf';
import {
  type WarehouseStaffSummary,
  WarehouseStaffSummarySchema,
  WarehouseStaffWorkRole,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';

import type { PermissionCallerValue } from '../../access/callGuard';
import type { IModuleRuntime } from '../moduleRuntime';
import type { WarehouseStaffMemberValue } from './warehouseStaffRoster';

import { isWarehouseInScope } from '../../access/permissionScope';
import { readStaffObservations } from './warehouseStaffObservations';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

interface VisibleStaffValue {
  canReadPerformance: boolean;
  canReadQualifications: boolean;
  canReadWork: boolean;
  member: WarehouseStaffMemberValue;
  summary: WarehouseStaffSummary;
  timeZone: string;
}

export const readVisibleStaff = (
  runtime: IModuleRuntime, caller: PermissionCallerValue, warehouseId: string | undefined,
): VisibleStaffValue[] => {
  const { read } = runtime;
  if (caller.admission.kind !== 'membership') {
    throw runtime.errors.membershipRequired();
  }
  const roster = runtime.wmsStaff ?? [];
  const members = new Set(read.listBy('memberships', 'organizationId', caller.organizationId).map(member => member.userId));
  const hasPermission = (name: string, warehouse: string): boolean =>
    caller.permissions.some(grant => grant.permission === name && isWarehouseInScope(grant, warehouse));
  const observations = new Map<string, ReturnType<typeof readStaffObservations>>();
  const warehouseObservations = (member: WarehouseStaffMemberValue): ReturnType<typeof readStaffObservations> => {
    let latest = observations.get(member.warehouseId);
    if (latest === undefined) {
      const topology = readOwnedWarehouseTopology(read, runtime.errors, member.warehouseId, member.organizationId);
      latest = topology === undefined ? new Map() : readStaffObservations(runtime, topology);
      observations.set(member.warehouseId, latest);
    }
    return latest;
  };
  const currentArea = (member: WarehouseStaffMemberValue): string | undefined => {
    const observation = warehouseObservations(member).get(member.userId);
    return observation === undefined ? member.workplace?.areaId : observation.areaId;
  };
  const visible: VisibleStaffValue[] = [];
  for (const member of roster) {
    const { workplace } = member;
    if (member.organizationId !== caller.organizationId || workplace === undefined || !members.has(member.userId)
      || (warehouseId !== undefined && member.warehouseId !== warehouseId) || !isWarehouseInScope(caller.scope, member.warehouseId)) {
      continue;
    }
    const warehouse = read.get('warehouses', member.warehouseId);
    const user = read.get('users', member.userId);
    if (warehouse?.tenantId !== caller.organizationId || user === undefined) {
      continue;
    }
    const own = roster.find(candidate => candidate.userId === caller.user.id && candidate.warehouseId === member.warehouseId
      && candidate.organizationId === caller.organizationId && candidate.workplace !== undefined);
    const isOwn = member.userId === caller.user.id;
    const isLead = own?.workplace?.isTeamLead === true;
    const isTeamMember = isLead && own.workplace?.teamId !== undefined && own.workplace.teamId === workplace.teamId;
    const canReadPerformance = isOwn || isTeamMember || hasPermission('staff_performance_view', member.warehouseId);
    const canReadQualifications = isOwn || isTeamMember || hasPermission('staff_qualification_view', member.warehouseId);
    const canReadArea = own !== undefined && !isOwn && !isLead
      && currentArea(own) !== undefined && currentArea(own) === currentArea(member);
    const canReadWork = canReadPerformance || isLead || canReadArea;
    if (canReadWork || canReadQualifications) {
      visible.push({
        canReadPerformance,
        canReadQualifications,
        canReadWork,
        member,
        summary: create(WarehouseStaffSummarySchema, {
          avatarKey: workplace.workRole.toLowerCase(),
          displayName: user.displayName,
          observedAreaId: canReadWork ? warehouseObservations(member).get(member.userId)?.areaId : undefined,
          staffId: member.userId,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          workRole: WarehouseStaffWorkRole[workplace.workRole],
        }),
        timeZone: warehouse.timeZone,
      });
    }
  }
  return visible.sort((current, prev) =>
    current.member.warehouseId.localeCompare(prev.member.warehouseId) || current.member.userId.localeCompare(prev.member.userId));
};
