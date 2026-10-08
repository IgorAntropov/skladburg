import {
  create,
  fromJson,
  toBinary,
} from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  type ErrorDetail,
  ErrorDetailSchema,
  FieldViolationSchema,
  PermissionDeniedParamsSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { getErrorTraits } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { apiErrorFromDetail } from './apiErrorFromDetail';
import { getFieldViolations } from './getFieldViolations';
import { parseApiError } from './parseApiError';

const UNKNOWN_ERROR_CODE = fromJson(ErrorDetailSchema, { code: 999 }).code;

type DetailPatchValue = Partial<Pick<ErrorDetail, 'params' | 'traceId'>>;

const createDetail = (code: ErrorCode, patch: DetailPatchValue = {}): ErrorDetail => create(ErrorDetailSchema, {
  code,
  traceId: 'trace-1',
  ...patch,
});

const createErrorWithDetail = (detail: ErrorDetail): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: detail }],
);

const knownCodes = Object.values(ErrorCode)
  .filter((value): value is ErrorCode => typeof value === 'number' && value !== ErrorCode.UNSPECIFIED);

describe('parseApiError', () => {
  it('reads the code, params and trace id from the error detail', () => {
    const detail = createDetail(ErrorCode.PERMISSION_DENIED, {
      params: { case: 'permissionDenied', value: create(PermissionDeniedParamsSchema, { permission: 'deal_approve' }) },
      traceId: 'trace-42',
    });

    const result = parseApiError(createErrorWithDetail(detail));

    expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(result.traceId).toBe('trace-42');
    expect(result.params.case).toBe('permissionDenied');
    expect(result.params.case === 'permissionDenied' && result.params.value.permission).toBe('deal_approve');
  });

  it('reads the detail from the binary form it has after the transport', () => {
    const detail = createDetail(ErrorCode.NOT_FOUND);
    const error = new ConnectError('not found', Code.NotFound);
    error.details.push({ type: ErrorDetailSchema.typeName, value: toBinary(ErrorDetailSchema, detail) });

    expect(parseApiError(error)).toMatchObject({ code: ErrorCode.NOT_FOUND, traceId: 'trace-1' });
  });

  it('takes isRetryable from the error traits of the contract for every code', () => {
    for (const code of knownCodes) {
      const { isRetryable } = parseApiError(createErrorWithDetail(createDetail(code)));

      expect(isRetryable, ErrorCode[code]).toBe(getErrorTraits(code).isRetryable);
    }
  });

  it('marks only unavailable and internal as retryable', () => {
    const retryableCodes = knownCodes.filter(code => parseApiError(createErrorWithDetail(createDetail(code))).isRetryable);

    expect(retryableCodes.toSorted()).toEqual([ErrorCode.UNAVAILABLE, ErrorCode.INTERNAL].toSorted());
  });

  it('has no trace id when the detail carries an empty one', () => {
    expect(parseApiError(createErrorWithDetail(createDetail(ErrorCode.NOT_FOUND, { traceId: '' }))).traceId).toBeUndefined();
  });

  it('turns an unspecified or unknown code of the detail into internal', () => {
    expect(parseApiError(createErrorWithDetail(createDetail(ErrorCode.UNSPECIFIED))).code).toBe(ErrorCode.INTERNAL);
    expect(parseApiError(createErrorWithDetail(createDetail(UNKNOWN_ERROR_CODE))).code).toBe(ErrorCode.INTERNAL);
  });

  it.each([Code.Unavailable, Code.DeadlineExceeded])('turns the transport code %s without a detail into retryable unavailable', (code) => {
    expect(parseApiError(new ConnectError('down', code))).toEqual({
      code: ErrorCode.UNAVAILABLE,
      isRetryable: true,
      params: { case: undefined },
      traceId: undefined,
    });
  });

  it.each([
    Code.Canceled,
    Code.Unknown,
    Code.InvalidArgument,
    Code.NotFound,
    Code.PermissionDenied,
    Code.Internal,
  ])('turns the transport code %s without a detail into internal', (code) => {
    expect(parseApiError(new ConnectError('failed', code))).toMatchObject({
      code: ErrorCode.INTERNAL,
      params: { case: undefined },
      traceId: undefined,
    });
  });

  it.each([
    ['an Error', new Error('boom')],
    ['a string', 'boom'],
    ['undefined', undefined],
    ['null', null],
    ['a plain object', { code: ErrorCode.NOT_FOUND }],
  ])('turns %s into internal and does not retry it', (_name, error) => {
    expect(parseApiError(error)).toEqual({
      code: ErrorCode.INTERNAL,
      isRetryable: false,
      params: { case: undefined },
      traceId: undefined,
    });
  });

  it('keeps a connect error without a detail and with the internal transport code retryable', () => {
    expect(parseApiError(new ConnectError('failed', Code.Internal)).isRetryable).toBe(true);
  });
});

describe('apiErrorFromDetail', () => {
  it('builds the same value as parseApiError for the same detail', () => {
    const detail = createDetail(ErrorCode.VERSION_CONFLICT);

    expect(apiErrorFromDetail(detail)).toEqual(parseApiError(createErrorWithDetail(detail)));
  });

  it('keeps the validation violations in the params', () => {
    const detail = createDetail(ErrorCode.VALIDATION_FAILED, {
      params: {
        case: 'validationFailed',
        value: create(ValidationFailedParamsSchema, {
          violations: [create(FieldViolationSchema, { fieldPath: 'headers', ruleId: 'headers.invalid' })],
        }),
      },
    });

    const result = apiErrorFromDetail(detail);

    expect(result.isRetryable).toBe(false);
    expect(getFieldViolations(result).map(violation => violation.ruleId)).toEqual(['headers.invalid']);
  });
});
