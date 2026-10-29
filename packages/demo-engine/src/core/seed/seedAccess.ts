import { create } from '@bufbuild/protobuf';
import {
  type Membership,
  MembershipSchema,
  type Role,
  type User,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';

import {
  createPresetRole,
  listPresetsForProfiles,
  RolePresetKey,
} from '../access/index';
import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';
import { createSeedOrganizations } from './seedOrganizations';

const ROLE_ID_PREFIX = '4';
const ROLE_ID_SUFFIX = '-0000-4000-8000-000000000000';
const ROLE_ID_PADDING = '00';
const ORGANIZATION_NUMBER_START = 5;
const ORGANIZATION_NUMBER_END = 8;

const PRESET_NUMBERS: Record<RolePresetKey, string> = {
  [RolePresetKey.ACCOUNTANT]: '02',
  [RolePresetKey.ADMIN]: '01',
  [RolePresetKey.BUYER]: '03',
  [RolePresetKey.DIRECTOR]: '00',
  [RolePresetKey.DISPATCHER]: '06',
  [RolePresetKey.SALES_MANAGER]: '04',
  [RolePresetKey.STOREKEEPER]: '05',
};

export const createSeedRoleId = (organizationId: string, presetKey: RolePresetKey): string => {
  const organizationNumber = organizationId.slice(ORGANIZATION_NUMBER_START, ORGANIZATION_NUMBER_END);

  return `${ROLE_ID_PREFIX}${PRESET_NUMBERS[presetKey]}${ROLE_ID_PADDING}${organizationNumber}${ROLE_ID_SUFFIX}`;
};

interface SeedAdminDefinitionValue {
  membershipId: string;
  organizationId: string;
  roleIds: readonly string[];
  userId: string;
  userName: string;
}

interface SeedAmountLimitValue {
  amountMinor: bigint;
  currencyCode: string;
}

interface SeedBuyerDefinitionValue {
  amountLimit: SeedAmountLimitValue;
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
    roleIds: [SeedRoleId.DIRECTOR_CUSTOMER_1, SeedRoleId.ACCOUNTANT_CUSTOMER_1],
    userId: SeedUserId.ADMIN_1,
    userName: 'Анна Смирнова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_2,
    organizationId: SeedOrganizationId.SUPPLIER_1,
    roleIds: [SeedRoleId.DIRECTOR_SUPPLIER_1],
    userId: SeedUserId.ADMIN_2,
    userName: 'Сергей Кузнецов',
  },
  {
    membershipId: SeedMembershipId.ADMIN_3,
    organizationId: SeedOrganizationId.SUPPLIER_2,
    roleIds: [SeedRoleId.DIRECTOR_SUPPLIER_2],
    userId: SeedUserId.ADMIN_3,
    userName: 'Ольга Попова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_4,
    organizationId: SeedOrganizationId.CARRIER_1,
    roleIds: [SeedRoleId.DIRECTOR_CARRIER_1],
    userId: SeedUserId.ADMIN_4,
    userName: 'Дмитрий Васильев',
  },
  {
    membershipId: SeedMembershipId.ADMIN_5,
    organizationId: SeedOrganizationId.CUSTOMER_2,
    roleIds: [SeedRoleId.DIRECTOR_CUSTOMER_2],
    userId: SeedUserId.ADMIN_5,
    userName: 'Елена Морозова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_6,
    organizationId: SeedOrganizationId.SUPPLIER_3,
    roleIds: [SeedRoleId.DIRECTOR_SUPPLIER_3],
    userId: SeedUserId.ADMIN_6,
    userName: 'Андрей Новиков',
  },
  {
    membershipId: SeedMembershipId.ADMIN_7,
    organizationId: SeedOrganizationId.SUPPLIER_4,
    roleIds: [SeedRoleId.DIRECTOR_SUPPLIER_4],
    userId: SeedUserId.ADMIN_7,
    userName: 'Татьяна Фёдорова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_8,
    organizationId: SeedOrganizationId.CARRIER_2,
    roleIds: [SeedRoleId.DIRECTOR_CARRIER_2],
    userId: SeedUserId.ADMIN_8,
    userName: 'Павел Волков',
  },
  {
    membershipId: SeedMembershipId.ADMIN_9,
    organizationId: SeedOrganizationId.SUPPLIER_5,
    roleIds: [SeedRoleId.DIRECTOR_SUPPLIER_5],
    userId: SeedUserId.ADMIN_9,
    userName: 'Наталья Козлова',
  },
  {
    membershipId: SeedMembershipId.ADMIN_10,
    organizationId: SeedOrganizationId.SUPPLIER_6,
    roleIds: [SeedRoleId.DIRECTOR_SUPPLIER_6],
    userId: SeedUserId.ADMIN_10,
    userName: 'Григорий Зуев',
  },
  {
    membershipId: SeedMembershipId.ADMIN_11,
    organizationId: SeedOrganizationId.SUPPLIER_7,
    roleIds: [SeedRoleId.DIRECTOR_SUPPLIER_7],
    userId: SeedUserId.ADMIN_11,
    userName: 'Степан Ершов',
  },
];

const SEED_BUYER_DEFINITIONS: readonly SeedBuyerDefinitionValue[] = [
  {
    amountLimit: { amountMinor: 10_000_000n, currencyCode: 'RUB' },
    membershipId: SeedMembershipId.BUYER_1,
    organizationId: SeedOrganizationId.CUSTOMER_1,
    roleId: SeedRoleId.BUYER_CUSTOMER_1,
    userId: SeedUserId.BUYER_1,
    userName: 'Кирилл Орлов',
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

export const createSeedUsers = (): User[] => [
  ...SEED_ADMIN_DEFINITIONS,
  ...SEED_BUYER_DEFINITIONS,
  ...SEED_STOREKEEPER_DEFINITIONS,
].map(definition => create(UserSchema, {
  displayName: definition.userName,
  id: definition.userId,
}));

export const createSeedRoles = (): Role[] => createSeedOrganizations().flatMap(organization =>
  listPresetsForProfiles(organization.profiles.map(profile => profile.kind))
    .map(preset => createPresetRole(preset, organization, createSeedRoleId(organization.id, preset.key))));

export const createSeedMemberships = (): Membership[] => [
  ...SEED_ADMIN_DEFINITIONS.map(definition => create(MembershipSchema, {
    id: definition.membershipId,
    organizationId: definition.organizationId,
    roleAssignments: definition.roleIds.map(roleId => ({ roleId, warehouseIds: [] })),
    userId: definition.userId,
  })),
  ...SEED_BUYER_DEFINITIONS.map(definition => create(MembershipSchema, {
    id: definition.membershipId,
    organizationId: definition.organizationId,
    roleAssignments: [{ amountLimit: definition.amountLimit, roleId: definition.roleId, warehouseIds: [] }],
    userId: definition.userId,
  })),
  ...SEED_STOREKEEPER_DEFINITIONS.map(definition => create(MembershipSchema, {
    id: definition.membershipId,
    organizationId: definition.organizationId,
    roleAssignments: [{ roleId: definition.roleId, warehouseIds: [definition.warehouseId] }],
    userId: definition.userId,
  })),
];
