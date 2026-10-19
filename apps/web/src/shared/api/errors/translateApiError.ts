import type { Translate } from '@/shared/i18n';

import type { ApiErrorValue } from './apiErrorTypes';

import { getPermissionMessageKey } from '../permissions/getPermissionMessageKey';
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

  if (key !== 'error.permission_denied') {
    return t(key);
  }

  const permissionKey = getPermissionMessageKey(getDeniedPermission(error.params));

  return permissionKey === undefined
    ? t('error.permission_denied.unnamed')
    : t(key, { permission: t(permissionKey) });
};
