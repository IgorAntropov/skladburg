import type { PermissionNameValue } from '@skladburg/contracts/runtime';

import {
  findPermissionCode,
  getPermissionName,
} from '@skladburg/contracts/runtime';

import type { MessageKey } from '@/shared/i18n';

export type PermissionMessageKeyValue = ExistingMessageKey<`permission.${PermissionNameValue}`>;

type ExistingMessageKey<Key extends MessageKey> = Key;

export const getPermissionMessageKey = (permission: string): PermissionMessageKeyValue | undefined => {
  const code = findPermissionCode(permission);

  return code === undefined ? undefined : `permission.${getPermissionName(code)}`;
};
