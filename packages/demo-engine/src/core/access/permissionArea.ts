import {
  findPermissionCode,
  getPermissionTraits,
} from '@skladburg/contracts/runtime';

import { isPlatformOperator } from '../platform/index';

export const isPlatformPermission = (name: string): boolean => {
  const code = findPermissionCode(name);

  return code !== undefined && getPermissionTraits(code).isPlatform;
};

export const isPermissionInOrganizationArea = (name: string, organizationId: string): boolean =>
  isPlatformPermission(name) === isPlatformOperator(organizationId);
