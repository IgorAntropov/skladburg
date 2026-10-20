import type { Translate } from '@/shared/i18n';

import type { ApiErrorValue } from './apiErrorTypes';

import { getErrorMessageKey } from './getErrorMessageKey';
import { translatePermissionDenial } from './translatePermissionDenial';

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

  if (key !== 'error.permission_denied') {
    return t(key);
  }

  return translatePermissionDenial(t, getDeniedPermission(error.params));
};
