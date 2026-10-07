import { create } from '@bufbuild/protobuf';
import {
  type Membership,
  MembershipSchema,
  type Role,
  RoleSchema,
  type User,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import { listPermissionNames } from '@skladburg/contracts/runtime';

import { ENGINE_SERVICES } from '../access/index';
import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';

export const ADMIN_PRESET_KEY = 'admin';
export const STOREKEEPER_PRESET_KEY = 'storekeeper';
export const STOREKEEPER_PERMISSIONS: readonly string[] = ['warehouse_view'];

interface SeedAdminDefinitionValue {
  membershipId: string;
  organizationId: string;
  roleId: string;
  userId: string;
  userName: string;
}

interface SeedStorekeeperDefinitionValue {
  membershipId: string;
  organizationId: string;
  roleId: string;
  userId: string;
  userName: string;
  warehouseId: string;
}

const SEED_ADMIN_DEFINITIONS: readonly SeedAdminDefinitionValue[] = [
  {
    membershipId: SeedMembershipId.ADMIN_1,
    organizationId: SeedOrganizationId.BUYER_1,
    roleId: SeedRoleId.ADMIN_BUYER_1,
    userId: SeedUserId.ADMIN_1,
    userName: 'Администратор 1',
  },
  {
    membershipId: SeedMembershipId.ADMIN_2,
    organizationId: SeedOrganizationId.SELLER_1,
    roleId: SeedRoleId.ADMIN_SELLER_1,
    userId: SeedUserId.ADMIN_2,
    userName: 'Администратор 2',
  },
  {
    membershipId: SeedMembershipId.ADMIN_3,
    organizationId: SeedOrganizationId.SELLER_2,
    roleId: SeedRoleId.ADMIN_SELLER_2,
    userId: SeedUserId.ADMIN_3,
    userName: 'Администратор 3',
  },
  {
    membershipId: SeedMembershipId.ADMIN_4,
    organizationId: SeedOrganizationId.CARRIER_1,
    roleId: SeedRoleId.ADMIN_CARRIER_1,
    userId: SeedUserId.ADMIN_4,
    userName: 'Администратор 4',
  },
  {
    membershipId: SeedMembershipId.ADMIN_5,
    organizationId: SeedOrganizationId.BUYER_2,
    roleId: SeedRoleId.ADMIN_BUYER_2,
    userId: SeedUserId.ADMIN_5,
    userName: 'Администратор 5',
  },
  {
    membershipId: SeedMembershipId.ADMIN_6,
    organizationId: SeedOrganizationId.SELLER_3,
    roleId: SeedRoleId.ADMIN_SELLER_3,
    userId: SeedUserId.ADMIN_6,
    userName: 'Администратор 6',
  },
  {
    membershipId: SeedMembershipId.ADMIN_7,
    organizationId: SeedOrganizationId.SELLER_4,
    roleId: SeedRoleId.ADMIN_SELLER_4,
    userId: SeedUserId.ADMIN_7,
    userName: 'Администратор 7',
  },
  {
    membershipId: SeedMembershipId.ADMIN_8,
    organizationId: SeedOrganizationId.CARRIER_2,
    roleId: SeedRoleId.ADMIN_CARRIER_2,
    userId: SeedUserId.ADMIN_8,
    userName: 'Администратор 8',
  },
  {
    membershipId: SeedMembershipId.ADMIN_9,
    organizationId: SeedOrganizationId.SELLER_5,
    roleId: SeedRoleId.ADMIN_SELLER_5,
    userId: SeedUserId.ADMIN_9,
    userName: 'Администратор 9',
  },
];

const SEED_STOREKEEPER_DEFINITIONS: readonly SeedStorekeeperDefinitionValue[] = [
  {
    membershipId: SeedMembershipId.STOREKEEPER_1,
    organizationId: SeedOrganizationId.BUYER_1,
    roleId: SeedRoleId.STOREKEEPER_BUYER_1,
    userId: SeedUserId.STOREKEEPER_1,
    userName: 'Кладовщик 1',
    warehouseId: SeedWarehouseId.BUYER_1_WAREHOUSE_1,
  },
  {
    membershipId: SeedMembershipId.STOREKEEPER_2,
    organizationId: SeedOrganizationId.BUYER_2,
    roleId: SeedRoleId.STOREKEEPER_BUYER_2,
    userId: SeedUserId.STOREKEEPER_2,
    userName: 'Кладовщик 2',
    warehouseId: SeedWarehouseId.BUYER_2_SITE_1,
  },
];

export const listSeedAdminPermissions = (): string[] => listPermissionNames(ENGINE_SERVICES);

export const createSeedUsers = (): User[] => [
  ...SEED_ADMIN_DEFINITIONS,
  ...SEED_STOREKEEPER_DEFINITIONS,
].map(definition => create(UserSchema, {
  displayName: definition.userName,
  id: definition.userId,
}));

export const createSeedRoles = (): Role[] => [
  ...SEED_ADMIN_DEFINITIONS.map(definition => create(RoleSchema, {
    id: definition.roleId,
    name: 'Администратор',
    permissions: listSeedAdminPermissions(),
    presetKey: ADMIN_PRESET_KEY,
    tenantId: definition.organizationId,
  })),
  ...SEED_STOREKEEPER_DEFINITIONS.map(definition => create(RoleSchema, {
    id: definition.roleId,
    name: 'Кладовщик',
    permissions: [...STOREKEEPER_PERMISSIONS],
    presetKey: STOREKEEPER_PRESET_KEY,
    tenantId: definition.organizationId,
  })),
];

export const createSeedMemberships = (): Membership[] => [
  ...SEED_ADMIN_DEFINITIONS.map(definition => create(MembershipSchema, {
    id: definition.membershipId,
    organizationId: definition.organizationId,
    roleAssignments: [{ roleId: definition.roleId, warehouseIds: [] }],
    userId: definition.userId,
  })),
  ...SEED_STOREKEEPER_DEFINITIONS.map(definition => create(MembershipSchema, {
    id: definition.membershipId,
    organizationId: definition.organizationId,
    roleAssignments: [{ roleId: definition.roleId, warehouseIds: [definition.warehouseId] }],
    userId: definition.userId,
  })),
];
