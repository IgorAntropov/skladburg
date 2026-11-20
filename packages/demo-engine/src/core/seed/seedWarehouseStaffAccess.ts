import { create } from '@bufbuild/protobuf';
import {
  type Membership,
  MembershipSchema,
  type User,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';

import type { EngineSnapshotValue } from '../ports/index';
import type { DemoPersonaValue } from '../state/records';

import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from '../../protocol/constants';
import { TABLE_DEFINITIONS } from '../state/tables';
import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedPersonaId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';

const STAFF_ACCOUNTS = [
  ['WAREHOUSE_LEAD', 'Алексей Ветров'],
  ['WAREHOUSE_OPERATOR', 'Нина Озерова'],
  ['WAREHOUSE_PICKER', 'Лев Речкин'],
  ['COMPANY_ADMIN', 'Инна Снегова'],
] as const;

const organizationId = SeedOrganizationId.CUSTOMER_1;

const createStaffUsers = (): User[] => STAFF_ACCOUNTS.map(([key, displayName]) =>
  create(UserSchema, { displayName, id: SeedUserId[key] }));

const createStaffMemberships = (): Membership[] => STAFF_ACCOUNTS.map(([key]) => create(MembershipSchema, {
  id: SeedMembershipId[key],
  organizationId,
  roleAssignments: key === 'COMPANY_ADMIN'
    ? [{ roleId: SeedRoleId.ADMIN_CUSTOMER_1 }]
    : [{ roleId: SeedRoleId.STOREKEEPER_CUSTOMER_1, warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3] }],
  userId: SeedUserId[key],
}));

const createStaffPersonas = (): DemoPersonaValue[] => STAFF_ACCOUNTS.map(([key]) => ({
  group: DemoPersonaGroup.FRESH,
  id: SeedPersonaId[key],
  kind: key === 'COMPANY_ADMIN' ? DemoPersonaKind.CUSTOMER : DemoPersonaKind.STOREKEEPER,
  organizationId,
  userId: SeedUserId[key],
}));

export const addStaffAccounts = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const { collections } = snapshot;
  if (!collections.organizations.has(SeedOrganizationId.CUSTOMER_1)) {
    return snapshot;
  }
  const memberships = new Map(collections.memberships);
  const personas = new Map(collections.personas);
  const users = new Map(collections.users);
  for (const user of createStaffUsers()) {
    if (!users.has(user.id)) {
      users.set(user.id, TABLE_DEFINITIONS.users.encode(user));
    }
  }
  for (const member of createStaffMemberships()) {
    if (!memberships.has(member.id)) {
      memberships.set(member.id, TABLE_DEFINITIONS.memberships.encode(member));
    }
  }
  for (const persona of createStaffPersonas()) {
    if (!personas.has(persona.id)) {
      personas.set(persona.id, TABLE_DEFINITIONS.personas.encode(persona));
    }
  }
  return { ...snapshot, collections: { ...collections, memberships, personas, users } };
};
