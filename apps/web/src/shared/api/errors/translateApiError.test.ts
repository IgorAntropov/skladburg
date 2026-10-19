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
    userTimeZone: 'UTC',
  });

  t = localizer.getSnapshot().t;
});

describe('translateApiError', () => {
  it('puts the permission name into the text', () => {
    const error = createError(ErrorCode.PERMISSION_DENIED, {
      case: 'permissionDenied',
      value: create(PermissionDeniedParamsSchema, { permission: 'deal_approve' }),
    });

    const text = translateApiError(t, error);

    expect(text).toBe(t('error.permission_denied', { permission: t('permission.deal_approve') }));
    expect(text).toContain(t('permission.deal_approve'));
    expect(text).not.toContain('deal_approve');
    expect(text).not.toMatch(/\{\w+\}/u);
  });

  it('uses the unnamed text for an unknown permission', () => {
    const text = translateApiError(t, createError(ErrorCode.PERMISSION_DENIED, {
      case: 'permissionDenied',
      value: create(PermissionDeniedParamsSchema, { permission: 'no_such_permission' }),
    }));

    expect(text).toBe(t('error.permission_denied.unnamed'));
    expect(text).not.toContain('no_such_permission');
  });

  it('uses the unnamed text when the permission field is empty', () => {
    const text = translateApiError(t, createError(ErrorCode.PERMISSION_DENIED, {
      case: 'permissionDenied',
      value: create(PermissionDeniedParamsSchema, { permission: '' }),
    }));

    expect(text).toBe(t('error.permission_denied.unnamed'));
  });

  it('uses the unnamed text when the permission denial has no params', () => {
    expect(translateApiError(t, createError(ErrorCode.PERMISSION_DENIED))).toBe(t('error.permission_denied.unnamed'));
  });

  it('uses the unnamed text when the permission denial carries params of another kind', () => {
    const text = translateApiError(t, createError(ErrorCode.PERMISSION_DENIED, {
      case: 'notFound',
      value: create(NotFoundParamsSchema),
    }));

    expect(text).toBe(t('error.permission_denied.unnamed'));
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
