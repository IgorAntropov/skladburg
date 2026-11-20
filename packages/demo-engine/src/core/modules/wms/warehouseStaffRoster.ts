import type { CalendarDate } from '@skladburg/contracts/common/v1/date';
import type { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import type { WarehouseStaffWorkRole } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';

import type { IModuleRuntime } from '../moduleRuntime';

export interface WarehouseStaffCredentialValue {
  expiresOn: CalendarDate;
  kind: WarehouseStaffQualificationKind;
}

export interface WarehouseStaffMemberValue {
  credentials: readonly WarehouseStaffCredentialValue[];
  organizationId: string;
  userId: string;
  warehouseId: string;
  workplace: undefined | WarehouseStaffWorkplaceValue;
}

export interface WarehouseStaffWorkplaceValue {
  areaId: string | undefined;
  isTeamLead: boolean;
  teamId: string | undefined;
  workRole: Exclude<keyof typeof WarehouseStaffWorkRole, 'UNSPECIFIED'>;
}

export const readWarehouseStaffQualifications = (
  runtime: Pick<IModuleRuntime, 'wmsStaff'>, organizationId: string, warehouseId: string, userId: string,
): readonly WarehouseStaffCredentialValue[] => runtime.wmsStaff?.find(member =>
  member.organizationId === organizationId && member.warehouseId === warehouseId && member.userId === userId)?.credentials ?? [];
