import type { EffectivePermission } from '@skladburg/contracts/access/v1/access';

import { findPermissionCode } from '@skladburg/contracts/runtime';

import type { CommandAccessValue } from '@/shared/api';

import type { PermissionScopeValue } from '../model/permissionScope';
import type { CommandRequirementValue } from './readCommandRequirement';

import { isPermissionGranted } from './isPermissionGranted';

const ALLOWED_ACCESS: CommandAccessValue = { status: 'allowed' };
const CHECKING_ACCESS: CommandAccessValue = { status: 'checking' };

export const resolveCommandAccess = (
  requirement: CommandRequirementValue,
  permissions: readonly EffectivePermission[] | undefined,
  scope: PermissionScopeValue,
): CommandAccessValue => {
  if (requirement.kind === 'open') {
    return ALLOWED_ACCESS;
  }

  if (permissions === undefined) {
    return CHECKING_ACCESS;
  }

  const code = findPermissionCode(requirement.permission);

  return code !== undefined && isPermissionGranted(permissions, code, scope)
    ? ALLOWED_ACCESS
    : { permission: requirement.permission, status: 'denied' };
};
