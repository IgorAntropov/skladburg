import type { Translate } from '@/shared/i18n';

import type { ApiErrorValue } from './apiErrorTypes';

import { getErrorMessageKey } from './getErrorMessageKey';

const getDeniedPermission = (params: ApiErrorValue['params']): string => {
  switch (params.case) {
    case 'invalidTransition':
    case 'limitExceeded':
    case 'notFound':
    case undefined:
    case 'validationFailed':
    case 'versionConflict':
      return '';
    case 'permissionDenied':
      return params.value.permission;
    default: {
      const unhandledParams: never = params;

      return unhandledParams;
    }
  }
};

export const translateApiError = (t: Translate, error: ApiErrorValue): string => {
  const key = getErrorMessageKey(error.code);

  return key === 'error.permission_denied'
    ? t(key, { permission: getDeniedPermission(error.params) })
    : t(key);
};
