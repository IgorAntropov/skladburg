import type { Translate } from '@/shared/i18n';

import { getPermissionMessageKey } from '../permissions/getPermissionMessageKey';

export const translatePermissionDenial = (t: Translate, permission: string): string => {
  const permissionKey = getPermissionMessageKey(permission);

  return permissionKey === undefined
    ? t('error.permission_denied.unnamed')
    : t('error.permission_denied', { permission: t(permissionKey) });
};
