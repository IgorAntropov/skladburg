import {
  ErrorCode,
  WarehouseStaffQualificationFailure,
} from '@skladburg/contracts/common/v1/error';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';

import type { ApiErrorValue } from '@/shared/api';

import type { warehouseQualificationMessages } from '../i18n/warehouseQualificationRu';

const qualificationNames = {
  [WarehouseStaffQualificationKind.COLD_ROOM]: 'warehouseQualification.coldRoom',
  [WarehouseStaffQualificationKind.FORKLIFT]: 'warehouseQualification.forklift',
  [WarehouseStaffQualificationKind.MEDICAL_BOOK]: 'warehouseQualification.medicalBook',
  [WarehouseStaffQualificationKind.UNSPECIFIED]: undefined,
} as const satisfies Record<WarehouseStaffQualificationKind, keyof typeof warehouseQualificationMessages | undefined>;

type QualificationNameKey = Exclude<(typeof qualificationNames)[WarehouseStaffQualificationKind], undefined>;

interface WarehouseQualificationFailureValue {
  message: 'warehouseQualification.expired' | 'warehouseQualification.missing';
  qualification: QualificationNameKey;
}

export const getWarehouseQualificationNameKey = (kind: WarehouseStaffQualificationKind): QualificationNameKey | undefined =>
  qualificationNames[kind];

export const getWarehouseQualificationFailure = (error: ApiErrorValue | undefined): undefined | WarehouseQualificationFailureValue => {
  if (error?.code !== ErrorCode.WAREHOUSE_STAFF_QUALIFICATION_REQUIRED || error.params.case !== 'warehouseStaffQualificationRequired') {
    return undefined;
  }
  const { kind, reason } = error.params.value;
  const qualification = getWarehouseQualificationNameKey(kind);
  if (qualification === undefined) {
    return undefined;
  }
  switch (reason) {
    case WarehouseStaffQualificationFailure.EXPIRED: return { message: 'warehouseQualification.expired', qualification };
    case WarehouseStaffQualificationFailure.MISSING: return { message: 'warehouseQualification.missing', qualification };
    default: return undefined;
  }
};
