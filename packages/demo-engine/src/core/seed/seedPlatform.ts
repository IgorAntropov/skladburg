import { create } from '@bufbuild/protobuf';
import {
  type Membership,
  MembershipSchema,
  type Role,
  type User,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  AssistantAddressForm,
  type Organization,
  OrganizationSchema,
  type OrganizationSettings,
  OrganizationSettingsSchema,
} from '@skladburg/contracts/organization/v1/organization';

import {
  createOperatorPresetRole,
  listOperatorPresets,
  OperatorPresetKey,
} from '../access/index';
import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../platform/index';
import {
  SeedMembershipId,
  SeedRoleId,
  SeedUserId,
} from './seedIds';
import { SEED_DEFAULT_LOCALE } from './seedOrganizations';

interface SeedOperatorStaffDefinitionValue {
  membershipId: string;
  presetKey: OperatorPresetKey;
  userId: string;
  userName: string;
}

export const PLATFORM_OPERATOR_NAME = 'Тридок';

export const SEED_OPERATOR_ROLE_IDS: Readonly<Record<OperatorPresetKey, string>> = {
  [OperatorPresetKey.PLATFORM_ADMIN]: SeedRoleId.OPERATOR_PLATFORM_ADMIN,
  [OperatorPresetKey.SUPER_ADMIN]: SeedRoleId.OPERATOR_SUPER_ADMIN,
  [OperatorPresetKey.SUPPORT_AGENT]: SeedRoleId.OPERATOR_SUPPORT_AGENT,
  [OperatorPresetKey.SUPPORT_ENGINEER]: SeedRoleId.OPERATOR_SUPPORT_ENGINEER,
};

export const SEED_OPERATOR_STAFF_DEFINITIONS: readonly SeedOperatorStaffDefinitionValue[] = [
  {
    membershipId: SeedMembershipId.OPERATOR_SUPPORT_AGENT,
    presetKey: OperatorPresetKey.SUPPORT_AGENT,
    userId: SeedUserId.OPERATOR_SUPPORT_AGENT,
    userName: 'Анна С.',
  },
  {
    membershipId: SeedMembershipId.OPERATOR_SUPPORT_ENGINEER,
    presetKey: OperatorPresetKey.SUPPORT_ENGINEER,
    userId: SeedUserId.OPERATOR_SUPPORT_ENGINEER,
    userName: 'Илья Г.',
  },
  {
    membershipId: SeedMembershipId.OPERATOR_PLATFORM_ADMIN,
    presetKey: OperatorPresetKey.PLATFORM_ADMIN,
    userId: SeedUserId.OPERATOR_PLATFORM_ADMIN,
    userName: 'Марина К.',
  },
  {
    membershipId: SeedMembershipId.OPERATOR_SUPER_ADMIN_1,
    presetKey: OperatorPresetKey.SUPER_ADMIN,
    userId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
    userName: 'Олег Б.',
  },
  {
    membershipId: SeedMembershipId.OPERATOR_SUPER_ADMIN_2,
    presetKey: OperatorPresetKey.SUPER_ADMIN,
    userId: SeedUserId.OPERATOR_SUPER_ADMIN_2,
    userName: 'Вера Л.',
  },
];

export const createSeedPlatformOrganizations = (): Organization[] => [
  create(OrganizationSchema, {
    id: PLATFORM_OPERATOR_ORGANIZATION_ID,
    inn: '0000001101',
    kpp: '000001010',
    legalName: `ООО «${PLATFORM_OPERATOR_NAME}»`,
    name: PLATFORM_OPERATOR_NAME,
    ogrn: '1000000011011',
    profiles: [],
    sphereIds: [],
  }),
];

export const createSeedPlatformOrganizationSettings = (): OrganizationSettings[] => [
  create(OrganizationSettingsSchema, {
    assistantAddressForm: AssistantAddressForm.FORMAL,
    availableLocales: [SEED_DEFAULT_LOCALE],
    brandName: PLATFORM_OPERATOR_NAME,
    defaultLocale: SEED_DEFAULT_LOCALE,
    organizationId: PLATFORM_OPERATOR_ORGANIZATION_ID,
  }),
];

export const createSeedPlatformRoles = (): Role[] => listOperatorPresets()
  .map(preset => createOperatorPresetRole(preset, SEED_OPERATOR_ROLE_IDS[preset.key]));

export const createSeedPlatformUsers = (): User[] => SEED_OPERATOR_STAFF_DEFINITIONS.map(definition => create(UserSchema, {
  displayName: definition.userName,
  id: definition.userId,
}));

export const createSeedPlatformMemberships = (): Membership[] =>
  SEED_OPERATOR_STAFF_DEFINITIONS.map(definition => create(MembershipSchema, {
    id: definition.membershipId,
    organizationId: PLATFORM_OPERATOR_ORGANIZATION_ID,
    roleAssignments: [{ roleId: SEED_OPERATOR_ROLE_IDS[definition.presetKey], warehouseIds: [] }],
    userId: definition.userId,
  }));
