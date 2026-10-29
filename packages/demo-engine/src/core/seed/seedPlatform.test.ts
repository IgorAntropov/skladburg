import { createClient } from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import { getPermissionName } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  listOperatorPresets,
  listPermissionsForOperator,
  OperatorPresetKey,
  resolvePermissionGrants,
  summarizePermissionGrants,
} from '../access/index';
import { createTestEngine } from '../engine/testing/engineHarness';
import {
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../modules/testing/moduleHarness';
import {
  isPlatformOperator,
  PLATFORM_OPERATOR_ORGANIZATION_ID,
} from '../platform/index';
import {
  createEngineState,
  type IStateReader,
} from '../state/index';
import { isOrganizationVerified } from '../visibility/index';
import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedUserId,
} from './seedIds';
import {
  SEED_OPERATOR_ROLE_IDS,
  SEED_OPERATOR_STAFF_DEFINITIONS,
} from './seedPlatform';
import {
  createSeedRecords,
  createSeedSnapshot,
} from './seedSnapshot';

const EXPECTED_STAFF = [
  [SeedUserId.OPERATOR_SUPPORT_AGENT, 'Ксения Р.', OperatorPresetKey.SUPPORT_AGENT],
  [SeedUserId.OPERATOR_SUPPORT_ENGINEER, 'Илья Г.', OperatorPresetKey.SUPPORT_ENGINEER],
  [SeedUserId.OPERATOR_PLATFORM_ADMIN, 'Марина К.', OperatorPresetKey.PLATFORM_ADMIN],
  [SeedUserId.OPERATOR_SUPER_ADMIN_1, 'Олег Б.', OperatorPresetKey.SUPER_ADMIN],
  [SeedUserId.OPERATOR_SUPER_ADMIN_2, 'Вера Л.', OperatorPresetKey.SUPER_ADMIN],
] as const;

const OPERATOR_USER_IDS: readonly string[] = EXPECTED_STAFF.map(([userId]) => userId);

const createSeedReader = (): IStateReader => createEngineState(createSeedSnapshot()).read;

describe('the platform operator organization in the seed', () => {
  it('is named Тридок, has the reserved id and holds no market profile', () => {
    const operator = createSeedReader().get('organizations', PLATFORM_OPERATOR_ORGANIZATION_ID);

    expect(operator).toMatchObject({ legalName: 'ООО «Тридок»', name: 'Тридок' });
    expect(operator?.profiles).toEqual([]);
    expect(operator?.sphereIds).toEqual([]);
    expect(isPlatformOperator(operator?.id ?? '')).toBe(true);
  });

  it('is the only organization of the seed that the operator rule recognises', () => {
    const operators = createSeedReader().list('organizations').filter(organization => isPlatformOperator(organization.id));

    expect(operators.map(organization => organization.id)).toEqual([PLATFORM_OPERATOR_ORGANIZATION_ID]);
  });

  it('has its own settings with the Russian locale', () => {
    expect(createSeedReader().get('organizationSettings', PLATFORM_OPERATOR_ORGANIZATION_ID)).toMatchObject({
      availableLocales: ['ru'],
      brandName: 'Тридок',
      defaultLocale: 'ru',
    });
  });

  it('owns no warehouse', () => {
    expect(createSeedReader().listBy('warehouses', 'tenantId', PLATFORM_OPERATOR_ORGANIZATION_ID)).toEqual([]);
  });

  it('starts without support access sessions', () => {
    expect(createSeedSnapshot().collections.supportAccessSessions.size).toBe(0);
    expect(createSeedRecords().supportAccessSessions).toEqual([]);
  });
});

describe('the roles of the platform operator in the seed', () => {
  const reader = createSeedReader();

  it('gives the operator exactly one role per operator preset, named by the preset', () => {
    const roles = reader.listBy('roles', 'tenantId', PLATFORM_OPERATOR_ORGANIZATION_ID);

    expect(roles.map(role => role.presetKey).sort()).toEqual(listOperatorPresets().map(preset => preset.key).sort());
    expect(roles.map(role => role.name).sort()).toEqual(listOperatorPresets().map(preset => preset.name).sort());
  });

  it('builds the permissions of each role from the operator preset', () => {
    for (const preset of listOperatorPresets()) {
      const role = reader.get('roles', SEED_OPERATOR_ROLE_IDS[preset.key]);
      const expected = preset.selectPermissions(listPermissionsForOperator()).map(code => getPermissionName(code));

      expect(role?.presetKey, preset.key).toBe(preset.key);
      expect(role?.tenantId, preset.key).toBe(PLATFORM_OPERATOR_ORGANIZATION_ID);
      expect([...(role?.permissions ?? [])].sort(), preset.key).toEqual([...expected].sort());
    }
  });

  it('keeps the role ids distinct from the ids of the client roles', () => {
    const clientRoleIds = new Set(
      createSeedRecords().roles.filter(role => !isPlatformOperator(role.tenantId)).map(role => role.id),
    );

    for (const roleId of Object.values(SEED_OPERATOR_ROLE_IDS)) {
      expect(clientRoleIds.has(roleId), roleId).toBe(false);
    }

    expect(new Set(Object.values(SEED_OPERATOR_ROLE_IDS)).size).toBe(listOperatorPresets().length);
  });
});

describe('the staff of the platform operator in the seed', () => {
  const reader = createSeedReader();

  it('names five fictional people as a first name and a last initial', () => {
    expect(EXPECTED_STAFF.map(([userId]) => reader.get('users', userId)?.displayName)).toEqual(
      EXPECTED_STAFF.map(([, displayName]) => displayName),
    );
    expect(SEED_OPERATOR_STAFF_DEFINITIONS).toHaveLength(5);
  });

  it('gives every staff member exactly one membership, in the operator organization', () => {
    for (const [userId, , presetKey] of EXPECTED_STAFF) {
      const memberships = reader.listBy('memberships', 'userId', userId);

      expect(memberships, userId).toHaveLength(1);
      expect(memberships[0]?.organizationId, userId).toBe(PLATFORM_OPERATOR_ORGANIZATION_ID);
      expect(memberships[0]?.roleAssignments, userId).toHaveLength(1);
      expect(memberships[0]?.roleAssignments[0]?.roleId, userId).toBe(SEED_OPERATOR_ROLE_IDS[presetKey]);
      expect(memberships[0]?.roleAssignments[0]?.warehouseIds, userId).toEqual([]);
    }
  });

  it('keeps the operator memberships to the staff alone', () => {
    const memberships = reader.listBy('memberships', 'organizationId', PLATFORM_OPERATOR_ORGANIZATION_ID);

    expect(memberships.map(membership => membership.userId).sort()).toEqual([...OPERATOR_USER_IDS].sort());
    expect(memberships.map(membership => membership.id).sort()).toEqual([
      SeedMembershipId.OPERATOR_PLATFORM_ADMIN,
      SeedMembershipId.OPERATOR_SUPER_ADMIN_1,
      SeedMembershipId.OPERATOR_SUPER_ADMIN_2,
      SeedMembershipId.OPERATOR_SUPPORT_AGENT,
      SeedMembershipId.OPERATOR_SUPPORT_ENGINEER,
    ].sort());
  });

  it('grants every staff member the permissions of the preset as organization-wide', () => {
    for (const [userId, , presetKey] of EXPECTED_STAFF) {
      const membership = reader.listBy('memberships', 'userId', userId)[0];
      const preset = listOperatorPresets().find(candidate => candidate.key === presetKey);
      const expected = (preset?.selectPermissions(listPermissionsForOperator()) ?? []).map(code => getPermissionName(code)).sort();

      expect(membership, userId).toBeDefined();

      const effective = membership === undefined ? [] : summarizePermissionGrants(resolvePermissionGrants(reader, membership));

      expect(effective.map(entry => entry.permission).sort(), userId).toEqual(expected);
      expect(expected.length, userId).toBeGreaterThan(0);
      expect(effective.every(entry => entry.isOrganizationWide && entry.warehouseIds.length === 0), userId).toBe(true);
    }
  });

  it('gives the two super administrators the same permissions as each other and more than the platform administrator', () => {
    const permissionsOf = (userId: string): string[] => {
      const membership = reader.listBy('memberships', 'userId', userId)[0];

      return membership === undefined
        ? []
        : summarizePermissionGrants(resolvePermissionGrants(reader, membership)).map(entry => entry.permission);
    };

    expect(permissionsOf(SeedUserId.OPERATOR_SUPER_ADMIN_1)).toEqual(permissionsOf(SeedUserId.OPERATOR_SUPER_ADMIN_2));
    const superAdminCount = permissionsOf(SeedUserId.OPERATOR_SUPER_ADMIN_1).length;

    expect(superAdminCount).toBeGreaterThan(permissionsOf(SeedUserId.OPERATOR_PLATFORM_ADMIN).length);
  });

  it('keeps every staff member out of every client organization', () => {
    const clientMemberships = createSeedRecords().memberships.filter(membership => !isPlatformOperator(membership.organizationId));

    expect(clientMemberships.length).toBeGreaterThan(0);

    for (const membership of clientMemberships) {
      expect(OPERATOR_USER_IDS, membership.id).not.toContain(membership.userId);
    }
  });

  it('keeps client people out of the operator organization', () => {
    const operatorMemberships = createSeedRecords().memberships.filter(membership => isPlatformOperator(membership.organizationId));

    expect(operatorMemberships).toHaveLength(OPERATOR_USER_IDS.length);
  });
});

describe('the isolation of the platform operator from the market', () => {
  const FRESH_CUSTOMER = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
  const CONSTRUCTION_CUSTOMER = callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2);
  const UNVERIFIED_SUPPLIER = callAs(SeedUserId.ADMIN_9, SeedOrganizationId.SUPPLIER_5);

  it('does not count the operator as a verified organization', () => {
    const operator = createSeedReader().get('organizations', PLATFORM_OPERATOR_ORGANIZATION_ID);

    if (operator === undefined) {
      throw new Error('Expected the operator organization in the seed');
    }

    expect(isOrganizationVerified(operator)).toBe(false);
  });

  it('keeps the operator off the showcase of verified and unverified viewers', async () => {
    const harness = createModuleHarness();
    const showcase = createClient(OrganizationShowcaseService, harness.transport);

    for (const options of [FRESH_CUSTOMER, CONSTRUCTION_CUSTOMER, UNVERIFIED_SUPPLIER]) {
      const { organizations } = await showcase.listOrganizationShowcases({}, options);

      expect(organizations.map(organization => organization.id)).not.toContain(PLATFORM_OPERATOR_ORGANIZATION_ID);
      expect(organizations.map(organization => organization.name)).not.toContain('Тридок');
    }
  });

  it('answers the showcase card of the operator with not_found', async () => {
    const harness = createModuleHarness();
    const showcase = createClient(OrganizationShowcaseService, harness.transport);
    const error = await captureError(
      showcase.getOrganizationShowcase({ organizationId: PLATFORM_OPERATOR_ORGANIZATION_ID }, FRESH_CUSTOMER),
    );

    expect(readErrorDetail(error).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('answers the organization directory of a client with not_found for the operator', async () => {
    const harness = createModuleHarness();
    const error = await captureError(harness.organization.getOrganization(
      { organizationId: PLATFORM_OPERATOR_ORGANIZATION_ID },
      FRESH_CUSTOMER,
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('puts no operator site on the map: the operator has no warehouse to show', async () => {
    const harness = createModuleHarness();
    const network = createClient(NetworkService, harness.transport);

    for (const options of [FRESH_CUSTOMER, CONSTRUCTION_CUSTOMER]) {
      const { mapSites } = await network.listMapSites({}, options);

      expect(mapSites.length).toBeGreaterThan(0);
      expect(mapSites.map(site => site.organizationId)).not.toContain(PLATFORM_OPERATOR_ORGANIZATION_ID);
    }
  });

  it('does not point any persona at the operator or at its staff', () => {
    const personas = createSeedReader().list('personas');

    expect(personas.length).toBeGreaterThan(0);

    for (const persona of personas) {
      expect(isPlatformOperator(persona.organizationId), persona.id).toBe(false);
      expect(OPERATOR_USER_IDS, persona.id).not.toContain(persona.userId);
    }
  });

  it('does not show the operator or its staff in the persona switcher list of the engine', async () => {
    const { engine } = await createTestEngine();
    const personas = engine.listPersonas();

    expect(personas).toHaveLength(9);

    for (const persona of personas) {
      expect(persona.organizationId, persona.id).not.toBe(PLATFORM_OPERATOR_ORGANIZATION_ID);
      expect(persona.organizationName, persona.id).not.toBe('Тридок');
      expect(OPERATOR_USER_IDS, persona.id).not.toContain(persona.userId);
    }
  });
});
