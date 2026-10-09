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
    organizationId: SeedOrganizationId.CUSTOMER_1,
    roleId: SeedRoleId.ADMIN_CUSTOMER_1,
    userId: SeedUserId.ADMIN_1,
    userName: 'Анна Смирнова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_2,
    organizationId: SeedOrganizationId.SUPPLIER_1,
    roleId: SeedRoleId.ADMIN_SUPPLIER_1,
    userId: SeedUserId.ADMIN_2,
    userName: 'Сергей Кузнецов',
  },
  {
    membershipId: SeedMembershipId.ADMIN_3,
    organizationId: SeedOrganizationId.SUPPLIER_2,
    roleId: SeedRoleId.ADMIN_SUPPLIER_2,
    userId: SeedUserId.ADMIN_3,
    userName: 'Ольга Попова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_4,
    organizationId: SeedOrganizationId.CARRIER_1,
    roleId: SeedRoleId.ADMIN_CARRIER_1,
    userId: SeedUserId.ADMIN_4,
    userName: 'Дмитрий Васильев',
  },
  {
    membershipId: SeedMembershipId.ADMIN_5,
    organizationId: SeedOrganizationId.CUSTOMER_2,
    roleId: SeedRoleId.ADMIN_CUSTOMER_2,
    userId: SeedUserId.ADMIN_5,
    userName: 'Елена Морозова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_6,
    organizationId: SeedOrganizationId.SUPPLIER_3,
    roleId: SeedRoleId.ADMIN_SUPPLIER_3,
    userId: SeedUserId.ADMIN_6,
    userName: 'Андрей Новиков',
  },
  {
    membershipId: SeedMembershipId.ADMIN_7,
    organizationId: SeedOrganizationId.SUPPLIER_4,
    roleId: SeedRoleId.ADMIN_SUPPLIER_4,
    userId: SeedUserId.ADMIN_7,
    userName: 'Татьяна Фёдорова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_8,
    organizationId: SeedOrganizationId.CARRIER_2,
    roleId: SeedRoleId.ADMIN_CARRIER_2,
    userId: SeedUserId.ADMIN_8,
    userName: 'Павел Волков',
  },
  {
    membershipId: SeedMembershipId.ADMIN_9,
    organizationId: SeedOrganizationId.SUPPLIER_5,
    roleId: SeedRoleId.ADMIN_SUPPLIER_5,
    userId: SeedUserId.ADMIN_9,
    userName: 'Наталья Козлова',
  },
];

const SEED_STOREKEEPER_DEFINITIONS: readonly SeedStorekeeperDefinitionValue[] = [
  {
    membershipId: SeedMembershipId.STOREKEEPER_1,
    organizationId: SeedOrganizationId.CUSTOMER_1,
    roleId: SeedRoleId.STOREKEEPER_CUSTOMER_1,
    userId: SeedUserId.STOREKEEPER_1,
    userName: 'Иван Соколов',
    warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
  },
  {
    membershipId: SeedMembershipId.STOREKEEPER_2,
    organizationId: SeedOrganizationId.CUSTOMER_2,
    roleId: SeedRoleId.STOREKEEPER_CUSTOMER_2,
    userId: SeedUserId.STOREKEEPER_2,
    userName: 'Мария Лебедева',
    warehouseId: SeedWarehouseId.CUSTOMER_2_SITE_1,
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
