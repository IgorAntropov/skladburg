import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCategory,
  ErrorCode,
  type ErrorDetail,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import { getErrorTraits } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSeededRandom } from '../ports/index';
import {
  createDomainErrors,
  getErrorMessage,
  type IDomainErrors,
} from './domainErrors';
import { toConnectCode } from './errorCodeMapping';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const EXPECTED_CONNECT_CODES: Readonly<Record<ErrorCode, Code>> = {
  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: Code.InvalidArgument,
  [ErrorCode.INTERNAL]: Code.Internal,
  [ErrorCode.INVALID_TRANSITION]: Code.FailedPrecondition,
  [ErrorCode.LIMIT_EXCEEDED]: Code.PermissionDenied,
  [ErrorCode.MEMBERSHIP_REQUIRED]: Code.PermissionDenied,
  [ErrorCode.NOT_FOUND]: Code.NotFound,
  [ErrorCode.PERMISSION_DENIED]: Code.PermissionDenied,
  [ErrorCode.SESSION_REQUIRED]: Code.Unauthenticated,
  [ErrorCode.UNAVAILABLE]: Code.Unavailable,
  [ErrorCode.UNSPECIFIED]: Code.Unknown,
  [ErrorCode.VALIDATION_FAILED]: Code.InvalidArgument,
  [ErrorCode.VERSION_CONFLICT]: Code.Aborted,
};

const ALL_ERROR_CODES: readonly ErrorCode[] = Object.values(ErrorCode).filter(value => typeof value === 'number');

const createErrors = (): IDomainErrors => createDomainErrors(createSeededRandom(7));

const readDetail = (error: ConnectError): ErrorDetail => {
  const [detail] = error.findDetails(ErrorDetailSchema);

  if (detail === undefined) {
    throw new Error('Error carries no ErrorDetail');
  }

  return detail;
};

describe('toConnectCode', () => {
  it.each([
    [ErrorCategory.ABORTED, Code.Aborted],
    [ErrorCategory.FAILED_PRECONDITION, Code.FailedPrecondition],
    [ErrorCategory.INTERNAL, Code.Internal],
    [ErrorCategory.INVALID_ARGUMENT, Code.InvalidArgument],
    [ErrorCategory.NOT_FOUND, Code.NotFound],
    [ErrorCategory.PERMISSION_DENIED, Code.PermissionDenied],
    [ErrorCategory.UNAUTHENTICATED, Code.Unauthenticated],
    [ErrorCategory.UNAVAILABLE, Code.Unavailable],
    [ErrorCategory.UNSPECIFIED, Code.Unknown],
  ])('maps category %s to Connect code %s', (category, expected) => {
    expect(toConnectCode(category)).toBe(expected);
  });
});

describe('createDomainErrors', () => {
  it('covers every error code of the contract in the expectations', () => {
    expect(Object.keys(EXPECTED_CONNECT_CODES).map(Number).sort()).toEqual([...ALL_ERROR_CODES].sort());
  });

  it.each(ALL_ERROR_CODES.filter(code => code !== ErrorCode.UNSPECIFIED))(
    'builds code %s with the Connect code of its category and a readable detail',
    (code) => {
      const error = createErrors().create(code);

      expect(error).toBeInstanceOf(ConnectError);
      expect(error.code).toBe(EXPECTED_CONNECT_CODES[code]);
      expect(error.code).toBe(toConnectCode(getErrorTraits(code).category));
      expect(error.rawMessage).toBe(ErrorCode[code].toLowerCase());
      expect(readDetail(error).code).toBe(code);
    },
  );

  it('uses the lowercase code name as the message, not a human text', () => {
    expect(getErrorMessage(ErrorCode.SESSION_REQUIRED)).toBe('session_required');
    expect(createErrors().sessionRequired().rawMessage).toBe('session_required');
  });

  it('takes the trace id from the random port as a UUID', () => {
    const detail = readDetail(createErrors().sessionRequired());

    expect(detail.traceId).toMatch(UUID_V4_PATTERN);
  });

  it('repeats trace ids for the same seed and differs between errors', () => {
    const first = createErrors();
    const second = createErrors();
    const firstIds = [first.sessionRequired(), first.membershipRequired()].map(error => readDetail(error).traceId);
    const secondIds = [second.sessionRequired(), second.membershipRequired()].map(error => readDetail(error).traceId);

    expect(firstIds).toEqual(secondIds);
    expect(firstIds[0]).not.toBe(firstIds[1]);
  });

  it('carries the permission name and the warehouse of permission_denied', () => {
    const detail = readDetail(createErrors().permissionDenied('warehouse_create', 'warehouse-1'));

    expect(detail.params.case).toBe('permissionDenied');
    expect(detail.params.value).toMatchObject({ permission: 'warehouse_create', warehouseId: 'warehouse-1' });
  });

  it('leaves the warehouse empty when permission_denied has no scope', () => {
    const detail = readDetail(createErrors().permissionDenied('warehouse_create'));

    expect(detail.params.value).toMatchObject({ warehouseId: '' });
  });

  it('carries the entity kind of not_found', () => {
    const error = createErrors().notFound(EntityKind.ORGANIZATION);
    const detail = readDetail(error);

    expect(error.code).toBe(Code.NotFound);
    expect(detail.params.case).toBe('notFound');
    expect(detail.params.value).toMatchObject({ entity: EntityKind.ORGANIZATION });
  });

  it('carries the violations of validation_failed', () => {
    const error = createErrors().validationFailed([
      { fieldPath: 'name', ruleId: 'string.min_len' },
      { fieldPath: 'capabilities[1]', ruleId: 'enum.not_in' },
    ]);
    const detail = readDetail(error);

    expect(error.code).toBe(Code.InvalidArgument);
    expect(detail.params.case).toBe('validationFailed');
    expect(detail.params.value).toMatchObject({
      violations: [
        { fieldPath: 'name', ruleId: 'string.min_len' },
        { fieldPath: 'capabilities[1]', ruleId: 'enum.not_in' },
      ],
    });
  });

  it('carries the limit and the requested amount of limit_exceeded', () => {
    const limit = create(MoneySchema, { amountMinor: 100n, currencyCode: 'RUB' });
    const requested = create(MoneySchema, { amountMinor: 250n, currencyCode: 'RUB' });
    const detail = readDetail(createErrors().limitExceeded('deal_approve', limit, requested));

    expect(detail.params.case).toBe('limitExceeded');
    expect(detail.params.value).toMatchObject({
      limit: { amountMinor: 100n },
      permission: 'deal_approve',
      requested: { amountMinor: 250n },
    });
  });

  it('carries the current version of version_conflict', () => {
    const detail = readDetail(createErrors().versionConflict(EntityKind.WAREHOUSE, 4));

    expect(detail.params.case).toBe('versionConflict');
    expect(detail.params.value).toMatchObject({ currentVersion: 4, entity: EntityKind.WAREHOUSE });
  });

  it('carries both statuses of invalid_transition', () => {
    const detail = readDetail(createErrors().invalidTransition(EntityKind.WAREHOUSE, 'draft', 'closed'));

    expect(detail.params.case).toBe('invalidTransition');
    expect(detail.params.value).toMatchObject({ fromStatus: 'draft', toStatus: 'closed' });
  });

  it('builds codes without parameters with an empty params branch', () => {
    expect(readDetail(createErrors().idempotencyKeyReused()).params.case).toBeUndefined();
    expect(readDetail(createErrors().membershipRequired()).params.case).toBeUndefined();
    expect(readDetail(createErrors().unavailable()).params.case).toBeUndefined();
  });

  it('keeps the cause of the error', () => {
    const cause = new Error('storage failed');

    expect(createErrors().internal(cause).cause).toBe(cause);
  });
});

describe('createDomainErrors.from', () => {
  it('returns a domain error as it is', () => {
    const errors = createErrors();
    const original = errors.notFound(EntityKind.ORGANIZATION);

    expect(errors.from(original)).toBe(original);
  });

  it('turns an unknown exception into internal with the exception as the cause', () => {
    const cause = new TypeError('boom');
    const error = createErrors().from(cause);

    expect(error.code).toBe(Code.Internal);
    expect(error.rawMessage).toBe('internal');
    expect(readDetail(error).code).toBe(ErrorCode.INTERNAL);
    expect(error.cause).toBe(cause);
  });

  it('turns a thrown non-error value into internal', () => {
    const error = createErrors().from('plain string');

    expect(readDetail(error).code).toBe(ErrorCode.INTERNAL);
  });

  it('turns a Connect error without a domain detail into internal', () => {
    const error = createErrors().from(new ConnectError('aborted by the client', Code.Canceled));

    expect(readDetail(error).code).toBe(ErrorCode.INTERNAL);
  });

  it('survives ConnectError.from on a domain error', () => {
    const original = createErrors().sessionRequired();

    expect(ConnectError.from(original)).toBe(original);
    expect(readDetail(ConnectError.from(original)).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});
