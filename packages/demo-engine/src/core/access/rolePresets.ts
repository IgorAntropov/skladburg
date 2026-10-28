import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  PermissionAction,
  type Role,
  RoleSchema,
} from '@skladburg/contracts/access/v1/access';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  getPermissionName,
  getPermissionTraits,
  type KnownPermissionCode,
  listPermissionCodes,
} from '@skladburg/contracts/runtime';

import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../platform/index';
import { isPlatformPermission } from './permissionArea';
import { splitPermissionName } from './permissionParts';

export const RolePresetKey = {
  ACCOUNTANT: 'accountant',
  ADMIN: 'admin',
  BUYER: 'buyer',
  DIRECTOR: 'director',
  DISPATCHER: 'dispatcher',
  SALES_MANAGER: 'sales_manager',
  STOREKEEPER: 'storekeeper',
} as const;

export type RolePresetKey = (typeof RolePresetKey)[keyof typeof RolePresetKey];

export const OperatorPresetKey = {
  PLATFORM_ADMIN: 'platform_admin',
  SUPER_ADMIN: 'super_admin',
  SUPPORT_AGENT: 'support_agent',
  SUPPORT_ENGINEER: 'support_engineer',
} as const;

export type OperatorPresetKey = (typeof OperatorPresetKey)[keyof typeof OperatorPresetKey];

export interface OperatorPresetValue {
  key: OperatorPresetKey;
  name: string;
  selectPermissions: (applicable: readonly KnownPermissionCode[]) => readonly KnownPermissionCode[];
}

export interface RolePresetValue {
  isWarehouseScoped: boolean;
  key: RolePresetKey;
  name: string;
  profiles: readonly ProfileKind[];
  selectPermissions: (applicable: readonly KnownPermissionCode[]) => readonly KnownPermissionCode[];
}

const ALL_PROFILES: readonly ProfileKind[] = [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER];

const SUPPORT_NAME_PREFIX = 'support_';

const MONEY_ACTIONS: readonly PermissionAction[] = [PermissionAction.FUND, PermissionAction.RELEASE];

const selectListed = (listed: readonly KnownPermissionCode[]): RolePresetValue['selectPermissions'] =>
  applicable => applicable.filter(code => listed.includes(code));

const selectWithoutMoneyActions: RolePresetValue['selectPermissions'] = applicable =>
  applicable.filter(code => !MONEY_ACTIONS.includes(splitPermissionName(getPermissionName(code)).action));

const ROLE_PRESETS: readonly RolePresetValue[] = [
  {
    isWarehouseScoped: false,
    key: RolePresetKey.DIRECTOR,
    name: 'Директор',
    profiles: ALL_PROFILES,
    selectPermissions: selectWithoutMoneyActions,
  },
  {
    isWarehouseScoped: false,
    key: RolePresetKey.ADMIN,
    name: 'Администратор',
    profiles: ALL_PROFILES,
    selectPermissions: selectListed([
      PermissionCode.MEMBER_MANAGE,
      PermissionCode.MEMBER_VIEW,
      PermissionCode.NETWORK_VIEW,
      PermissionCode.NOTIFICATION_MANAGE,
      PermissionCode.ORGANIZATION_EDIT,
      PermissionCode.ORGANIZATION_MANAGE,
      PermissionCode.SUPPORT_ACCESS_APPROVE,
      PermissionCode.SUPPORT_ACCESS_VIEW,
    ]),
  },
  {
    isWarehouseScoped: false,
    key: RolePresetKey.ACCOUNTANT,
    name: 'Бухгалтер',
    profiles: ALL_PROFILES,
    selectPermissions: selectListed([
      PermissionCode.ANALYTICS_EXPORT,
      PermissionCode.ANALYTICS_VIEW,
      PermissionCode.CLAIM_VIEW,
      PermissionCode.CONTRACT_VIEW,
      PermissionCode.DEAL_VIEW,
      PermissionCode.DOCUMENT_EXPORT,
      PermissionCode.DOCUMENT_SIGN,
      PermissionCode.DOCUMENT_VIEW,
      PermissionCode.PAYMENT_FUND,
      PermissionCode.PAYMENT_RELEASE,
      PermissionCode.PAYMENT_VIEW,
    ]),
  },
  {
    isWarehouseScoped: false,
    key: RolePresetKey.BUYER,
    name: 'Закупщик',
    profiles: [ProfileKind.CUSTOMER],
    selectPermissions: selectListed([
      PermissionCode.ANALYTICS_VIEW,
      PermissionCode.AUTO_ORDER_APPROVE,
      PermissionCode.AUTO_ORDER_VIEW,
      PermissionCode.CLAIM_CREATE,
      PermissionCode.CLAIM_VIEW,
      PermissionCode.CONTRACT_VIEW,
      PermissionCode.DEAL_APPROVE,
      PermissionCode.DEAL_CREATE,
      PermissionCode.DEAL_EDIT,
      PermissionCode.DEAL_VIEW,
      PermissionCode.DOCUMENT_VIEW,
      PermissionCode.INVENTORY_VIEW,
      PermissionCode.MARKETPLACE_VIEW,
      PermissionCode.NETWORK_VIEW,
      PermissionCode.PAYMENT_VIEW,
      PermissionCode.PROMOTION_VIEW,
      PermissionCode.REVIEW_CREATE,
      PermissionCode.TRANSPORT_OFFER_APPROVE,
      PermissionCode.TRANSPORT_REQUEST_CREATE,
      PermissionCode.TRANSPORT_REQUEST_VIEW,
      PermissionCode.TRIP_VIEW,
      PermissionCode.WAREHOUSE_VIEW,
    ]),
  },
  {
    isWarehouseScoped: false,
    key: RolePresetKey.SALES_MANAGER,
    name: 'Менеджер продаж',
    profiles: [ProfileKind.SUPPLIER],
    selectPermissions: selectListed([
      PermissionCode.ANALYTICS_VIEW,
      PermissionCode.CATALOG_EDIT,
      PermissionCode.CATALOG_VIEW,
      PermissionCode.CLAIM_APPROVE,
      PermissionCode.CLAIM_VIEW,
      PermissionCode.CONTRACT_EDIT,
      PermissionCode.CONTRACT_VIEW,
      PermissionCode.DEAL_APPROVE,
      PermissionCode.DEAL_EDIT,
      PermissionCode.DEAL_VIEW,
      PermissionCode.DOCUMENT_VIEW,
      PermissionCode.INVENTORY_VIEW,
      PermissionCode.NETWORK_VIEW,
      PermissionCode.PAYMENT_VIEW,
      PermissionCode.PRICE_LIST_EDIT,
      PermissionCode.PRICE_LIST_VIEW,
      PermissionCode.PROMOTION_EDIT,
      PermissionCode.PROMOTION_VIEW,
      PermissionCode.REVIEW_CREATE,
      PermissionCode.TRANSPORT_OFFER_APPROVE,
      PermissionCode.TRANSPORT_REQUEST_CREATE,
      PermissionCode.TRANSPORT_REQUEST_VIEW,
      PermissionCode.TRIP_VIEW,
      PermissionCode.WAREHOUSE_VIEW,
    ]),
  },
  {
    isWarehouseScoped: true,
    key: RolePresetKey.STOREKEEPER,
    name: 'Кладовщик',
    profiles: [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER],
    selectPermissions: selectListed([
      PermissionCode.INVENTORY_EDIT,
      PermissionCode.INVENTORY_VIEW,
      PermissionCode.SENSOR_VIEW,
      PermissionCode.TASK_EDIT,
      PermissionCode.TASK_VIEW,
      PermissionCode.WAREHOUSE_VIEW,
      PermissionCode.YARD_VIEW,
    ]),
  },
  {
    isWarehouseScoped: false,
    key: RolePresetKey.DISPATCHER,
    name: 'Диспетчер',
    profiles: [ProfileKind.CARRIER],
    selectPermissions: selectListed([
      PermissionCode.ANALYTICS_VIEW,
      PermissionCode.CLAIM_VIEW,
      PermissionCode.DEAL_VIEW,
      PermissionCode.DOCUMENT_VIEW,
      PermissionCode.FLEET_EDIT,
      PermissionCode.FLEET_VIEW,
      PermissionCode.NETWORK_VIEW,
      PermissionCode.TRANSPORT_OFFER_CREATE,
      PermissionCode.TRANSPORT_REQUEST_VIEW,
      PermissionCode.TRIP_EDIT,
      PermissionCode.TRIP_VIEW,
    ]),
  },
];

const OPERATOR_PRESETS: readonly OperatorPresetValue[] = [
  {
    key: OperatorPresetKey.SUPPORT_AGENT,
    name: 'Агент поддержки',
    selectPermissions: selectListed([
      PermissionCode.SUPPORT_TICKET_EDIT,
      PermissionCode.SUPPORT_TICKET_VIEW,
    ]),
  },
  {
    key: OperatorPresetKey.SUPPORT_ENGINEER,
    name: 'Инженер поддержки',
    selectPermissions: selectListed([
      PermissionCode.SUPPORT_SESSION_CREATE,
      PermissionCode.SUPPORT_SETTINGS_EDIT,
      PermissionCode.SUPPORT_TICKET_EDIT,
      PermissionCode.SUPPORT_TICKET_VIEW,
    ]),
  },
  {
    key: OperatorPresetKey.PLATFORM_ADMIN,
    name: 'Администратор платформы',
    selectPermissions: selectListed([
      PermissionCode.PLATFORM_DISPUTE_APPROVE,
      PermissionCode.PLATFORM_VERIFICATION_APPROVE,
      PermissionCode.SUPPORT_TICKET_VIEW,
    ]),
  },
  {
    key: OperatorPresetKey.SUPER_ADMIN,
    name: 'Супер-администратор',
    selectPermissions: applicable => applicable.filter(code => getPermissionName(code).startsWith(SUPPORT_NAME_PREFIX)),
  },
];

const isProfileIncluded = (profiles: readonly ProfileKind[], candidates: readonly ProfileKind[]): boolean =>
  candidates.some(candidate => profiles.includes(candidate));

export const listRolePresets = (): readonly RolePresetValue[] => ROLE_PRESETS;

export const listPresetsForProfiles = (profiles: readonly ProfileKind[]): readonly RolePresetValue[] =>
  ROLE_PRESETS.filter(preset => isProfileIncluded(preset.profiles, profiles));

export const listOperatorPresets = (): readonly OperatorPresetValue[] => OPERATOR_PRESETS;

export const listPermissionsForProfiles = (profiles: readonly ProfileKind[]): KnownPermissionCode[] =>
  listPermissionCodes().filter(code => isProfileIncluded(getPermissionTraits(code).profiles, profiles));

export const createPresetRole = (preset: RolePresetValue, organization: Organization, roleId: string): Role => {
  const applicable = listPermissionsForProfiles(organization.profiles.map(profile => profile.kind));

  return create(RoleSchema, {
    id: roleId,
    name: preset.name,
    permissions: preset.selectPermissions(applicable).map(code => getPermissionName(code)),
    presetKey: preset.key,
    tenantId: organization.id,
  });
};

export const listPermissionsForOperator = (): KnownPermissionCode[] =>
  listPermissionCodes().filter(code => isPlatformPermission(getPermissionName(code)));

export const createOperatorPresetRole = (preset: OperatorPresetValue, roleId: string): Role =>
  create(RoleSchema, {
    id: roleId,
    name: preset.name,
    permissions: preset.selectPermissions(listPermissionsForOperator()).map(code => getPermissionName(code)),
    presetKey: preset.key,
    tenantId: PLATFORM_OPERATOR_ORGANIZATION_ID,
  });
