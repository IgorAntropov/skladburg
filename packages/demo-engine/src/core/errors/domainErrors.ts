import type { EntityKind } from '@skladburg/contracts/common/v1/entity';
import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import {
  ErrorCode,
  type ErrorDetail,
  ErrorDetailSchema,
  FieldViolationSchema,
  InvalidTransitionParamsSchema,
  LimitExceededParamsSchema,
  NotFoundParamsSchema,
  PermissionDeniedParamsSchema,
  ValidationFailedParamsSchema,
  VersionConflictParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { getErrorTraits } from '@skladburg/contracts/runtime';

import type { IRandom } from '../ports/index';

import { toConnectCode } from './errorCodeMapping';

export type ErrorParamsValue = ErrorDetail['params'];

export interface IDomainErrors {
  create: (code: ErrorCode, params?: ErrorParamsValue, cause?: unknown) => ConnectError;
  from: (reason: unknown) => ConnectError;
  idempotencyKeyReused: () => ConnectError;
  internal: (cause?: unknown) => ConnectError;
  invalidTransition: (entity: EntityKind, fromStatus: string, toStatus: string) => ConnectError;
  limitExceeded: (permission: string, limit: Money, requested: Money) => ConnectError;
  membershipRequired: () => ConnectError;
  notFound: (entity: EntityKind) => ConnectError;
  permissionDenied: (permission: string, warehouseId?: string) => ConnectError;
  sessionRequired: () => ConnectError;
  unavailable: () => ConnectError;
  validationFailed: (violations: readonly ViolationValue[]) => ConnectError;
  versionConflict: (entity: EntityKind, currentVersion: number) => ConnectError;
}

export interface ViolationValue {
  fieldPath: string;
  ruleId: string;
}

export const getErrorMessage = (code: ErrorCode): string => ErrorCode[code].toLowerCase();

export const createDomainErrors = (random: IRandom): IDomainErrors => {
  const createError = (code: ErrorCode, params?: ErrorParamsValue, cause?: unknown): ConnectError => {
    const detail = create(ErrorDetailSchema, {
      code,
      params,
      traceId: random.uuid(),
    });

    return new ConnectError(
      getErrorMessage(code),
      toConnectCode(getErrorTraits(code).category),
      undefined,
      [{ desc: ErrorDetailSchema, value: detail }],
      cause,
    );
  };

  const internal = (cause?: unknown): ConnectError => createError(ErrorCode.INTERNAL, undefined, cause);

  const from = (reason: unknown): ConnectError => {
    const isDomainError = reason instanceof ConnectError && reason.findDetails(ErrorDetailSchema).length > 0;

    return isDomainError ? reason : internal(reason);
  };

  return {
    create: createError,
    from,
    idempotencyKeyReused: () => createError(ErrorCode.IDEMPOTENCY_KEY_REUSED),
    internal,
    invalidTransition: (entity, fromStatus, toStatus) => createError(ErrorCode.INVALID_TRANSITION, {
      case: 'invalidTransition',
      value: create(InvalidTransitionParamsSchema, { entity, fromStatus, toStatus }),
    }),
    limitExceeded: (permission, limit, requested) => createError(ErrorCode.LIMIT_EXCEEDED, {
      case: 'limitExceeded',
      value: create(LimitExceededParamsSchema, { limit, permission, requested }),
    }),
    membershipRequired: () => createError(ErrorCode.MEMBERSHIP_REQUIRED),
    notFound: entity => createError(ErrorCode.NOT_FOUND, {
      case: 'notFound',
      value: create(NotFoundParamsSchema, { entity }),
    }),
    permissionDenied: (permission, warehouseId) => createError(ErrorCode.PERMISSION_DENIED, {
      case: 'permissionDenied',
      value: create(PermissionDeniedParamsSchema, { permission, warehouseId: warehouseId ?? '' }),
    }),
    sessionRequired: () => createError(ErrorCode.SESSION_REQUIRED),
    unavailable: () => createError(ErrorCode.UNAVAILABLE),
    validationFailed: violations => createError(ErrorCode.VALIDATION_FAILED, {
      case: 'validationFailed',
      value: create(ValidationFailedParamsSchema, {
        violations: violations.map(violation => create(FieldViolationSchema, violation)),
      }),
    }),
    versionConflict: (entity, currentVersion) => createError(ErrorCode.VERSION_CONFLICT, {
      case: 'versionConflict',
      value: create(VersionConflictParamsSchema, { currentVersion, entity }),
    }),
  };
};
