import {
  create,
  fromJson,
} from '@bufbuild/protobuf';
import {
  ErrorCode,
  ErrorDetailSchema,
  InvalidTransitionParamsSchema,
  LimitExceededParamsSchema,
  NotFoundParamsSchema,
  PermissionDeniedParamsSchema,
  ValidationFailedParamsSchema,
  VersionConflictParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import type { Translate } from '@/shared/i18n';

import { createLocalizer } from '@/shared/i18n';

import type { ApiErrorValue } from './apiErrorTypes';

import { translateApiError } from './translateApiError';

const UNKNOWN_ERROR_CODE = fromJson(ErrorDetailSchema, { code: 999 }).code;

let t: Translate;

const createError = (code: ErrorCode, params: ApiErrorValue['params'] = { case: undefined }): ApiErrorValue => ({
  code,
  isRetryable: false,
  params,
  traceId: undefined,
});

beforeAll(async () => {
  const { defaultLocale } = defaultTenant;
  const localizer = await createLocalizer({
    bundledLocales: [defaultLocale],
    catalogLoaders: { [defaultLocale]: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: [defaultLocale], defaultLocale, termOverrides: {} },
  });

  t = localizer.getSnapshot().t;
});

describe('translateApiError', () => {
  it('puts the denied permission into the text', () => {
    const error = createError(ErrorCode.PERMISSION_DENIED, {
      case: 'permissionDenied',
      value: create(PermissionDeniedParamsSchema, { permission: 'deal_approve' }),
    });

    const text = translateApiError(t, error);

    expect(text).toBe(t('error.permission_denied', { permission: 'deal_approve' }));
    expect(text).toContain('deal_approve');
    expect(text).not.toContain('{permission}');
  });

  it('leaves no placeholder when the permission denial has no params', () => {
    const text = translateApiError(t, createError(ErrorCode.PERMISSION_DENIED));

    expect(text).toBe(t('error.permission_denied', { permission: '' }));
    expect(text).not.toContain('{permission}');
  });

  it('leaves no placeholder when the permission field is empty', () => {
    const text = translateApiError(t, createError(ErrorCode.PERMISSION_DENIED, {
      case: 'permissionDenied',
      value: create(PermissionDeniedParamsSchema, { permission: '' }),
    }));

    expect(text).toBe(t('error.permission_denied', { permission: '' }));
    expect(text).not.toContain('{permission}');
  });

  it('leaves no placeholder when the permission denial carries params of another kind', () => {
    const text = translateApiError(t, createError(ErrorCode.PERMISSION_DENIED, {
      case: 'notFound',
      value: create(NotFoundParamsSchema),
    }));

    expect(text).toBe(t('error.permission_denied', { permission: '' }));
  });

  it('gives the plain text for a code without params', () => {
    expect(translateApiError(t, createError(ErrorCode.SESSION_REQUIRED))).toBe(t('error.session_required'));
  });

  it('falls back to the internal error text for an unknown code', () => {
    expect(translateApiError(t, createError(UNKNOWN_ERROR_CODE))).toBe(t('error.internal'));
  });

  it('falls back to the internal error text for the unspecified code', () => {
    expect(translateApiError(t, createError(ErrorCode.UNSPECIFIED))).toBe(t('error.internal'));
  });

  it.each([
    ['limitExceeded', ErrorCode.LIMIT_EXCEEDED, 'error.limit_exceeded', {
      case: 'limitExceeded',
      value: create(LimitExceededParamsSchema),
    }],
    ['validationFailed', ErrorCode.VALIDATION_FAILED, 'error.validation_failed', {
      case: 'validationFailed',
      value: create(ValidationFailedParamsSchema),
    }],
    ['notFound', ErrorCode.NOT_FOUND, 'error.not_found', {
      case: 'notFound',
      value: create(NotFoundParamsSchema),
    }],
    ['versionConflict', ErrorCode.VERSION_CONFLICT, 'error.version_conflict', {
      case: 'versionConflict',
      value: create(VersionConflictParamsSchema),
    }],
    ['invalidTransition', ErrorCode.INVALID_TRANSITION, 'error.invalid_transition', {
      case: 'invalidTransition',
      value: create(InvalidTransitionParamsSchema),
    }],
  ] as const)('gives the plain text for %s params', (_, code, key, params) => {
    const text = translateApiError(t, createError(code, params));

    expect(text).toBe(t(key));
    expect(text).not.toMatch(/\{\w+\}/u);
  });
});
