import type { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { PermissionAction } from '@skladburg/contracts/access/v1/access';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  getPermissionName,
  getPermissionTraits,
  type KnownPermissionCode,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
} from '@skladburg/contracts/support/v1/support_access';

import type { EffectivePermissionValue } from './permissionScope';

import { isPlatformPermission } from './permissionArea';
import { splitPermissionName } from './permissionParts';
import { listPermissionsForProfiles } from './rolePresets';

export type SupportConcreteSection = Exclude<SupportAccessSection, SupportAccessSection.ALL | SupportAccessSection.UNSPECIFIED>;

export interface SupportSessionPermissionsInputValue {
  organizationProfiles: readonly ProfileKind[];
  session: SupportAccessSession;
  staffPermissions: readonly EffectivePermissionValue[];
}

export const SUPPORT_SECTION_BY_FEATURE: ReadonlyMap<string, SupportConcreteSection> = new Map([
  ['analytics', SupportAccessSection.DEALS],
  ['auto_order', SupportAccessSection.DEALS],
  ['catalog', SupportAccessSection.CATALOG],
  ['claim', SupportAccessSection.DEALS],
  ['contract', SupportAccessSection.DEALS],
  ['deal', SupportAccessSection.DEALS],
  ['document', SupportAccessSection.DEALS],
  ['fleet', SupportAccessSection.LOGISTICS],
  ['inventory', SupportAccessSection.WAREHOUSES],
  ['layout', SupportAccessSection.WAREHOUSES],
  ['marketplace', SupportAccessSection.CATALOG],
  ['member', SupportAccessSection.ORGANIZATION],
  ['network', SupportAccessSection.CATALOG],
  ['notification', SupportAccessSection.ORGANIZATION],
  ['organization', SupportAccessSection.ORGANIZATION],
  ['payment', SupportAccessSection.DEALS],
  ['price_list', SupportAccessSection.CATALOG],
  ['promotion', SupportAccessSection.CATALOG],
  ['review', SupportAccessSection.DEALS],
  ['sensor', SupportAccessSection.WAREHOUSES],
  ['staff', SupportAccessSection.WAREHOUSES],
  ['support_access', SupportAccessSection.ORGANIZATION],
  ['task', SupportAccessSection.WAREHOUSES],
  ['transport_offer', SupportAccessSection.LOGISTICS],
  ['transport_request', SupportAccessSection.LOGISTICS],
  ['trip', SupportAccessSection.LOGISTICS],
  ['warehouse', SupportAccessSection.WAREHOUSES],
  ['yard', SupportAccessSection.WAREHOUSES],
]);

const SUPPORT_ACCESS_FEATURE = 'support_access';

const SESSION_CREATE_PERMISSION = getPermissionName(PermissionCode.SUPPORT_SESSION_CREATE);

const SETTINGS_EDIT_PERMISSION = getPermissionName(PermissionCode.SUPPORT_SETTINGS_EDIT);

export const SUPPORT_SETTINGS_PERMISSIONS: readonly string[] = [
  getPermissionName(PermissionCode.ORGANIZATION_EDIT),
];

const NEVER_ACTIONS: readonly PermissionAction[] = [
  PermissionAction.APPROVE,
  PermissionAction.EXPORT,
  PermissionAction.FUND,
  PermissionAction.MANAGE,
  PermissionAction.RELEASE,
  PermissionAction.SIGN,
];

const DEAL_LIFECYCLE_FEATURES: readonly string[] = [
  'claim',
  'contract',
  'deal',
  'document',
  'payment',
  'review',
  'transport_offer',
  'transport_request',
  'trip',
];

const VIEW_ACTIONS: readonly PermissionAction[] = [PermissionAction.VIEW];

const EDIT_ACTIONS: readonly PermissionAction[] = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.EDIT,
  PermissionAction.DELETE,
];

const listModeActions = (mode: SupportAccessMode): readonly PermissionAction[] => {
  if (mode === SupportAccessMode.EDIT) {
    return EDIT_ACTIONS;
  }

  return mode === SupportAccessMode.VIEW ? VIEW_ACTIONS : [];
};

export const isPermissionNameNeverForSupport = (name: string, isLimitApplicable: boolean): boolean => {
  if (isLimitApplicable || isPlatformPermission(name)) {
    return true;
  }

  const { action, feature } = splitPermissionName(name);

  return NEVER_ACTIONS.includes(action)
    || feature === SUPPORT_ACCESS_FEATURE
    || (DEAL_LIFECYCLE_FEATURES.includes(feature) && action !== PermissionAction.VIEW);
};

export const isNeverForSupport = (code: KnownPermissionCode): boolean =>
  isPermissionNameNeverForSupport(getPermissionName(code), getPermissionTraits(code).isLimitApplicable);

export const listSupportStaffActions = (staffPermissions: readonly EffectivePermissionValue[]): readonly PermissionAction[] => {
  const hasPermission = (name: string): boolean => staffPermissions.some(candidate => candidate.permission === name);

  if (!hasPermission(SESSION_CREATE_PERMISSION)) {
    return [];
  }

  return hasPermission(SETTINGS_EDIT_PERMISSION) ? EDIT_ACTIONS : VIEW_ACTIONS;
};

export const resolveSupportSessionPermissions = (input: SupportSessionPermissionsInputValue): EffectivePermissionValue[] => {
  const { organizationProfiles, session, staffPermissions } = input;
  const staffActions = listSupportStaffActions(staffPermissions);
  const modeActions = listModeActions(session.mode);

  return listPermissionsForProfiles(organizationProfiles)
    .filter((code) => {
      const name = getPermissionName(code);
      const { action, feature } = splitPermissionName(name);
      const isSectionMatched = session.section === SupportAccessSection.ALL
        || SUPPORT_SECTION_BY_FEATURE.get(feature) === session.section;
      const isViewOrSetting = action === PermissionAction.VIEW || SUPPORT_SETTINGS_PERMISSIONS.includes(name);

      return isSectionMatched
        && isViewOrSetting
        && modeActions.includes(action)
        && staffActions.includes(action)
        && !isNeverForSupport(code);
    })
    .map(code => ({ isOrganizationWide: true, permission: getPermissionName(code), warehouseIds: [] }));
};
