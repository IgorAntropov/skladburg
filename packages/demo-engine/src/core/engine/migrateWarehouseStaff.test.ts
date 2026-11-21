import {
  expect,
  it,
} from 'vitest';

import {
  createSeedSnapshot,
  SeedMembershipId,
  SeedPersonaId,
  SeedRoleId,
  SeedUserId,
} from '../seed/index';
import { TABLE_DEFINITIONS } from '../state/index';
import { migrateStoredSnapshot } from './migrateStoredSnapshot';

it('adds warehouse staff to a v28 world once and preserves customized roles, membership scopes and private warehouse records', async () => {
  const legacy = createSeedSnapshot();
  legacy.schemaVersion = 28;
  const collections = {
    ...legacy.collections,
    memberships: new Map(legacy.collections.memberships),
    personas: new Map(legacy.collections.personas),
    roles: new Map(legacy.collections.roles),
    users: new Map(legacy.collections.users),
  };
  collections.users.delete(SeedUserId.WAREHOUSE_OPERATOR);
  collections.memberships.delete(SeedMembershipId.WAREHOUSE_OPERATOR);
  collections.personas.delete(SeedPersonaId.WAREHOUSE_OPERATOR);
  const grants = new Set(['staff_performance_view', 'staff_profile_view', 'staff_qualification_view']);
  for (const [id, bytes] of collections.roles) {
    const role = TABLE_DEFINITIONS.roles.decode(bytes);
    role.permissions = role.permissions.filter(permission => !grants.has(permission));
    if (id === SeedRoleId.STOREKEEPER_CUSTOMER_2) {
      role.permissions = role.permissions.filter(permission => permission !== 'task_edit');
    }
    collections.roles.set(id, TABLE_DEFINITIONS.roles.encode(role));
  }
  const migrated = await migrateStoredSnapshot({ ...legacy, collections }, undefined);
  const readRole = (id: string): readonly string[] => {
    const stored = migrated.collections.roles.get(id);
    if (stored === undefined) {
      throw new Error('Missing seed role');
    }
    return TABLE_DEFINITIONS.roles.decode(stored).permissions;
  };
  expect(migrated.collections.users.has(SeedUserId.WAREHOUSE_OPERATOR)).toBe(true);
  expect(migrated.collections.personas.has(SeedPersonaId.WAREHOUSE_OPERATOR)).toBe(true);
  expect(migrated.collections.memberships.has(SeedMembershipId.WAREHOUSE_OPERATOR)).toBe(true);
  expect(migrated.collections.memberships.get(SeedMembershipId.STOREKEEPER_2))
    .toEqual(collections.memberships.get(SeedMembershipId.STOREKEEPER_2));
  expect(migrated.collections.warehouseInbound).toBe(collections.warehouseInbound);
  expect(migrated.collections.yardDispatchEntries).toBe(collections.yardDispatchEntries);
  expect(readRole(SeedRoleId.STOREKEEPER_CUSTOMER_1)).toContain('staff_profile_view');
  expect(readRole(SeedRoleId.STOREKEEPER_CUSTOMER_2)).not.toContain('staff_profile_view');
  expect(readRole(SeedRoleId.STOREKEEPER_CUSTOMER_2)).not.toContain('task_edit');
  expect(readRole(SeedRoleId.DIRECTOR_CUSTOMER_1)).toEqual(expect.arrayContaining([...grants]));
  expect(await migrateStoredSnapshot({ ...migrated, schemaVersion: 28 }, undefined)).toEqual(migrated);
});
