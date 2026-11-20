import { create } from '@bufbuild/protobuf';
import {
  ErrorCode,
  WarehouseStaffQualificationFailure,
  WarehouseStaffQualificationRequiredParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  expect,
  it,
} from 'vitest';

import type { ApiErrorValue } from '@/shared/api';

import { getWarehouseQualificationFailure } from './warehouseQualification';

const failure = (reason: WarehouseStaffQualificationFailure, kind: WarehouseStaffQualificationKind): ApiErrorValue => ({
  code: ErrorCode.WAREHOUSE_STAFF_QUALIFICATION_REQUIRED,
  isRetryable: false,
  params: { case: 'warehouseStaffQualificationRequired', value: create(WarehouseStaffQualificationRequiredParamsSchema, { kind, reason }) },
  traceId: undefined,
});

it.each([
  [
    WarehouseStaffQualificationFailure.EXPIRED, WarehouseStaffQualificationKind.FORKLIFT,
    'warehouseQualification.expired', 'warehouseQualification.forklift',
  ],
  [
    WarehouseStaffQualificationFailure.MISSING, WarehouseStaffQualificationKind.COLD_ROOM,
    'warehouseQualification.missing', 'warehouseQualification.coldRoom',
  ],
] as const)('identifies the reason and the required credential on a rejected claim', (reason, kind, message, qualification) => {
  expect(getWarehouseQualificationFailure(failure(reason, kind))).toEqual({ message, qualification });
});

it('keeps the standard command notice for unknown or unrelated failures', () => {
  const expired = failure(WarehouseStaffQualificationFailure.EXPIRED, WarehouseStaffQualificationKind.MEDICAL_BOOK);
  expect(getWarehouseQualificationFailure({ ...expired, code: ErrorCode.PERMISSION_DENIED })).toBeUndefined();
  expect(getWarehouseQualificationFailure({ ...expired, params: { case: undefined } })).toBeUndefined();
  const unknownKind = failure(WarehouseStaffQualificationFailure.EXPIRED, WarehouseStaffQualificationKind.UNSPECIFIED);
  const unknownReason = failure(WarehouseStaffQualificationFailure.UNSPECIFIED, WarehouseStaffQualificationKind.FORKLIFT);
  expect(getWarehouseQualificationFailure(unknownKind)).toBeUndefined();
  expect(getWarehouseQualificationFailure(unknownReason)).toBeUndefined();
});
