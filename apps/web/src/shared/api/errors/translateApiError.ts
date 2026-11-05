import type { Translate } from '@/shared/i18n';

import type { ApiErrorValue } from './apiErrorTypes';

import { getErrorMessageKey } from './getErrorMessageKey';
import { translatePermissionDenial } from './translatePermissionDenial';

export const translateApiError = (t: Translate, error: ApiErrorValue): string => {
  const key = getErrorMessageKey(error.code);

  if (key !== 'error.permission_denied') {
    return t(key);
  }

  const permission = error.params.case === 'permissionDenied' ? error.params.value.permission : '';

  return translatePermissionDenial(t, permission);
};
