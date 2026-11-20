import type { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';

import { create } from '@bufbuild/protobuf';
import {
  ErrorCode,
  WarehouseStaffQualificationFailure,
  WarehouseStaffQualificationRequiredParamsSchema,
} from '@skladburg/contracts/common/v1/error';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  compareCalendarDates,
  toCalendarDate,
} from '../../calendar/index';
import { readWarehouseStaffQualifications } from './warehouseStaffRoster';

export const requireWarehouseTaskQualifications = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  task: { requiredQualifications: readonly WarehouseStaffQualificationKind[]; warehouseId: string },
): void => {
  if (task.requiredQualifications.length === 0) {
    return;
  }
  const warehouse = transaction.get('warehouses', task.warehouseId);
  if (warehouse?.tenantId !== caller.organizationId) {
    throw runtime.errors.internal();
  }
  const today = toCalendarDate(transaction.worldTimeMs, warehouse.timeZone);
  const credentials = readWarehouseStaffQualifications(runtime, caller.organizationId, task.warehouseId, caller.user.id);
  for (const kind of task.requiredQualifications) {
    const matching = credentials.filter(credential => credential.kind === kind);
    if (matching.some(credential => compareCalendarDates(credential.expiresOn, today) >= 0)) {
      continue;
    }
    throw runtime.errors.create(ErrorCode.WAREHOUSE_STAFF_QUALIFICATION_REQUIRED, {
      case: 'warehouseStaffQualificationRequired',
      value: create(WarehouseStaffQualificationRequiredParamsSchema, {
        kind,
        reason: matching.length === 0 ? WarehouseStaffQualificationFailure.MISSING : WarehouseStaffQualificationFailure.EXPIRED,
      }),
    });
  }
};
