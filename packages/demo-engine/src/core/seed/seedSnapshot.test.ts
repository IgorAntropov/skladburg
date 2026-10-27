import type { Membership } from '@skladburg/contracts/access/v1/access';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import { getPermissionName } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  listPermissionsForProfiles,
  listPresetsForProfiles,
  RolePresetKey,
} from '../access/index';
import { ENGINE_COLLECTION_NAMES } from '../ports/index';
import {
  createEngineState,
  DemoPersonaGroup,
  DemoPersonaKind,
  ENGINE_SCHEMA_VERSION,
  type IStateReader,
} from '../state/index';
import { createSeedRoleId } from './seedAccess';
import {
  SeedOrganizationId,
  SeedPersonaId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';
import {
  createSeedRecords,
  createSeedSnapshot,
  DEFAULT_ENGINE_SEED,
  SEED_TIME_SCALE,
  SEED_VERSION,
  SEED_WORLD_START_MS,
} from './seedSnapshot';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createSeedReader = (): IStateReader => createEngineState(createSeedSnapshot()).read;

const hasProfileKind = (kind: ProfileKind): ((organization: { profiles: readonly { kind: ProfileKind }[] }) => boolean) =>
  organization => organization.profiles.some(profile => profile.kind === kind);

describe('createSeedSnapshot', () => {
  it('is deterministic: two calls give equal snapshots', () => {
    expect(createSeedSnapshot()).toEqual(createSeedSnapshot());
  });

  it('gives equal snapshots for an explicit default seed', () => {
    expect(createSeedSnapshot(DEFAULT_ENGINE_SEED)).toEqual(createSeedSnapshot());
  });

  it('changes the random state and the world time with the seed', () => {
    const other = createSeedSnapshot({ randomSeed: 1, worldStartMs: 5 });

    expect(other.meta.randomState).not.toEqual(createSeedSnapshot().meta.randomState);
    expect(other.meta.traceRandomState).not.toEqual(createSeedSnapshot().meta.traceRandomState);
    expect(other.meta.worldTimeMs).toBe(5);
  });

  it('starts the trace random stream apart from the main one', () => {
    const { meta } = createSeedSnapshot();

    expect(meta.traceRandomState).not.toEqual(meta.randomState);
  });

  it('fills the meta with the seed constants and empty channels', () => {
    expect(createSeedSnapshot().meta).toMatchObject({
      channelSeq: {},
      seedVersion: SEED_VERSION,
      timeScale: SEED_TIME_SCALE,
      worldTimeMs: SEED_WORLD_START_MS,
    });
    expect(SEED_TIME_SCALE).toBe(1);
    expect(SEED_VERSION).toBe(9);
  });

  it('carries the current schema version', () => {
    expect(createSeedSnapshot().schemaVersion).toBe(ENGINE_SCHEMA_VERSION);
  });

  it('holds every collection and starts without idempotency records', () => {
    const snapshot = createSeedSnapshot();

    expect(Object.keys(snapshot.collections).sort()).toEqual([...ENGINE_COLLECTION_NAMES].sort());
    expect(snapshot.collections.idempotency.size).toBe(0);
    expect(snapshot.collections.organizations.size).toBeGreaterThan(0);
  });

  it('loads into the engine state and returns to the same snapshot', () => {
    const snapshot = createSeedSnapshot();
    const state = createEngineState(snapshot);

    expect(state.toSnapshot({
      randomState: snapshot.meta.randomState,
      schedulerDueAtMs: snapshot.meta.schedulerDueAtMs,
      timeScale: snapshot.meta.timeScale,
      traceRandomState: snapshot.meta.traceRandomState,
      worldTimeMs: snapshot.meta.worldTimeMs,
    })).toEqual(snapshot);
  });
});

describe('seed contents', () => {
  it('uses UUID literals for every id and keeps ids unique inside a collection', () => {
    const records = createSeedRecords();
    const snapshot = createSeedSnapshot();

    for (const name of ENGINE_COLLECTION_NAMES) {
      expect(snapshot.collections[name].size, name).toBe(records[name].length);

      for (const id of snapshot.collections[name].keys()) {
        expect(id, name).toMatch(UUID_PATTERN);
      }
    }
  });

  it('describes the nine organizations of the two verticals', () => {
    const reader = createSeedReader();

    expect(reader.list('organizations').map(organization => organization.name).sort()).toEqual([
      'Заказчик 1',
      'Заказчик 2',
      'Перевозчик 1',
      'Перевозчик 2',
      'Поставщик 1',
      'Поставщик 2',
      'Поставщик 3',
      'Поставщик 4',
      'Поставщик 5',
    ]);
  });

  it('gives the first customer exactly three warehouses in three cities', () => {
    const warehouses = createSeedReader().listBy('warehouses', 'tenantId', SeedOrganizationId.CUSTOMER_1);

    expect(warehouses).toHaveLength(3);
    expect(new Set(warehouses.map(warehouse => warehouse.cityId)).size).toBe(3);
  });

  it('gives the second customer two sites', () => {
    expect(createSeedReader().listBy('warehouses', 'tenantId', SeedOrganizationId.CUSTOMER_2)).toHaveLength(2);
  });

  it('gives the fourth supplier two profiles: supplier and carrier', () => {
    const organization = createSeedReader().get('organizations', SeedOrganizationId.SUPPLIER_4);

    expect(organization?.profiles.map(profile => profile.kind).sort()).toEqual([ProfileKind.SUPPLIER, ProfileKind.CARRIER].sort());
  });

  it('verifies the supplier profile of the fourth supplier and leaves its carrier profile at level 0', () => {
    const organization = createSeedReader().get('organizations', SeedOrganizationId.SUPPLIER_4);
    const levels = new Map(organization?.profiles.map(profile => [profile.kind, profile.verificationLevel]));

    expect(levels.get(ProfileKind.SUPPLIER)).toBe(2);
    expect(levels.get(ProfileKind.CARRIER)).toBe(0);
  });

  it('gives the first carrier verification level 1 and the second one level 3', () => {
    const reader = createSeedReader();

    expect(reader.get('organizations', SeedOrganizationId.CARRIER_1)?.profiles.map(profile => profile.verificationLevel)).toEqual([1]);
    expect(reader.get('organizations', SeedOrganizationId.CARRIER_2)?.profiles.map(profile => profile.verificationLevel)).toEqual([3]);
  });

  it('has customers, suppliers and carriers in both verticals', () => {
    const organizations = createSeedReader().list('organizations');

    expect(organizations.filter(hasProfileKind(ProfileKind.CUSTOMER))).toHaveLength(2);
    expect(organizations.filter(hasProfileKind(ProfileKind.SUPPLIER))).toHaveLength(5);
    expect(organizations.filter(hasProfileKind(ProfileKind.CARRIER))).toHaveLength(3);
  });

  it('separates the verticals by spheres, not by names', () => {
    const reader = createSeedReader();
    const spheres = reader.list('spheres');
    const roots = spheres.filter(sphere => sphere.parentId === '');
    const freshCustomer = reader.get('organizations', SeedOrganizationId.CUSTOMER_1);
    const constructionCustomer = reader.get('organizations', SeedOrganizationId.CUSTOMER_2);

    expect(roots).toHaveLength(2);
    expect(spheres.every(sphere => sphere.parentId === '' || roots.some(root => root.id === sphere.parentId))).toBe(true);
    expect(freshCustomer?.sphereIds).not.toEqual(constructionCustomer?.sphereIds);
  });

  it('has exactly one unverified organization, with verification level 0', () => {
    const unverified = createSeedReader()
      .list('organizations')
      .filter(organization => organization.profiles.every(profile => profile.verificationLevel === 0));

    expect(unverified.map(organization => organization.id)).toEqual([SeedOrganizationId.SUPPLIER_5]);
  });

  it('references only existing cities, nodes, spheres and organizations', () => {
    const reader = createSeedReader();

    for (const warehouse of reader.list('warehouses')) {
      expect(reader.get('cities', warehouse.cityId), warehouse.name).toBeDefined();
      expect(reader.get('mapNodes', warehouse.mapNodeId)?.cityId).toBe(warehouse.cityId);
      expect(reader.get('organizations', warehouse.tenantId)).toBeDefined();
      expect(reader.get('cities', warehouse.cityId)?.timeZone).toBe(warehouse.timeZone);
    }

    for (const organization of reader.list('organizations')) {
      organization.sphereIds.forEach((sphereId) => {
        expect(reader.get('spheres', sphereId)).toBeDefined();
      });
    }
  });

  it('places map nodes on distinct grid cells', () => {
    const cells = createSeedReader().list('mapNodes').map(node => `${String(node.position?.column)}:${String(node.position?.row)}`);

    expect(new Set(cells).size).toBe(cells.length);
  });

  it('joins the map nodes with eleven distinct route legs between existing nodes', () => {
    const reader = createSeedReader();
    const legs = reader.list('routeLegs');
    const pairs = legs.map(leg => [leg.fromMapNodeId, leg.toMapNodeId].sort().join('|'));

    expect(legs).toHaveLength(11);

    for (const leg of legs) {
      expect(reader.get('mapNodes', leg.fromMapNodeId), leg.id).toBeDefined();
      expect(reader.get('mapNodes', leg.toMapNodeId), leg.id).toBeDefined();
      expect(leg.fromMapNodeId, leg.id).not.toBe(leg.toMapNodeId);
      expect(leg.distanceKm, leg.id).toBeGreaterThan(0);
      expect(leg.driveMinutes, leg.id).toBeGreaterThan(0);
    }

    expect(new Set(pairs).size).toBe(legs.length);
  });

  it('keeps the route legs in one connected graph that reaches every map node', () => {
    const reader = createSeedReader();
    const nodeIds = reader.list('mapNodes').map(node => node.id);
    const legs = reader.list('routeLegs');
    const reached = new Set<string>(nodeIds.slice(0, 1));
    const queue = [...reached];

    while (queue.length > 0) {
      const current = queue.shift();

      for (const leg of legs) {
        const next = leg.fromMapNodeId === current ? leg.toMapNodeId : leg.toMapNodeId === current ? leg.fromMapNodeId : undefined;

        if (next !== undefined && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }

    expect([...reached].sort()).toEqual([...nodeIds].sort());
  });

  it('gives every organization settings with its name as brand and the Russian locale', () => {
    const reader = createSeedReader();

    for (const organization of reader.list('organizations')) {
      expect(reader.get('organizationSettings', organization.id)).toMatchObject({
        availableLocales: ['ru'],
        brandName: organization.name,
        defaultLocale: 'ru',
      });
    }
  });

  it('gives every organization the roles of all presets offered to its profiles', () => {
    const reader = createSeedReader();
    const organizations = reader.list('organizations');

    for (const organization of organizations) {
      const profiles = organization.profiles.map(profile => profile.kind);
      const presetKeys = listPresetsForProfiles(profiles).map(preset => preset.key);
      const roles = reader.listBy('roles', 'tenantId', organization.id);

      expect(roles.map(role => role.presetKey).sort(), organization.name).toEqual([...presetKeys].sort());
    }

    expect(reader.list('roles')).toHaveLength(44);
  });

  it('counts the role presets by the profiles of each organization', () => {
    const reader = createSeedReader();
    const countOf = (organizationId: string): number => reader.listBy('roles', 'tenantId', organizationId).length;

    expect(countOf(SeedOrganizationId.CUSTOMER_1)).toBe(5);
    expect(countOf(SeedOrganizationId.CUSTOMER_2)).toBe(5);
    expect(countOf(SeedOrganizationId.SUPPLIER_1)).toBe(5);
    expect(countOf(SeedOrganizationId.SUPPLIER_5)).toBe(5);
    expect(countOf(SeedOrganizationId.CARRIER_1)).toBe(4);
    expect(countOf(SeedOrganizationId.CARRIER_2)).toBe(4);
    expect(countOf(SeedOrganizationId.SUPPLIER_4)).toBe(6);
  });

  it('gives every role a distinct stable identifier built from the organization and the preset', () => {
    const { organizations, roles } = createSeedRecords();
    const idsByOrganizationAndPreset = new Map<string, string>(organizations.flatMap(organization =>
      Object.values(RolePresetKey).map((presetKey): [string, string] => [
        `${organization.id}:${presetKey}`,
        createSeedRoleId(organization.id, presetKey),
      ])));

    expect(new Set(roles.map(role => role.id)).size).toBe(roles.length);
    expect(new Set(idsByOrganizationAndPreset.values()).size).toBe(idsByOrganizationAndPreset.size);

    for (const role of roles) {
      expect(role.id, role.name).toMatch(UUID_PATTERN);
      expect(role.id, role.name).toBe(idsByOrganizationAndPreset.get(`${role.tenantId}:${role.presetKey}`));
    }
  });

  it('keeps the named role identifiers equal to the organization and preset rule', () => {
    expect(SeedRoleId.DIRECTOR_CUSTOMER_1).toBe(createSeedRoleId(SeedOrganizationId.CUSTOMER_1, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_SUPPLIER_1).toBe(createSeedRoleId(SeedOrganizationId.SUPPLIER_1, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_SUPPLIER_2).toBe(createSeedRoleId(SeedOrganizationId.SUPPLIER_2, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_CARRIER_1).toBe(createSeedRoleId(SeedOrganizationId.CARRIER_1, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_CUSTOMER_2).toBe(createSeedRoleId(SeedOrganizationId.CUSTOMER_2, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_SUPPLIER_3).toBe(createSeedRoleId(SeedOrganizationId.SUPPLIER_3, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_SUPPLIER_4).toBe(createSeedRoleId(SeedOrganizationId.SUPPLIER_4, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_CARRIER_2).toBe(createSeedRoleId(SeedOrganizationId.CARRIER_2, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.DIRECTOR_SUPPLIER_5).toBe(createSeedRoleId(SeedOrganizationId.SUPPLIER_5, RolePresetKey.DIRECTOR));
    expect(SeedRoleId.STOREKEEPER_CUSTOMER_1).toBe(createSeedRoleId(SeedOrganizationId.CUSTOMER_1, RolePresetKey.STOREKEEPER));
    expect(SeedRoleId.STOREKEEPER_CUSTOMER_2).toBe(createSeedRoleId(SeedOrganizationId.CUSTOMER_2, RolePresetKey.STOREKEEPER));
  });

  it('gives every organization one director with the permissions of its profiles except funding and release', () => {
    const reader = createSeedReader();

    for (const organization of reader.list('organizations')) {
      const profiles = organization.profiles.map(profile => profile.kind);
      const expected = listPermissionsForProfiles(profiles)
        .map(code => getPermissionName(code))
        .filter(name => !name.endsWith('_fund') && !name.endsWith('_release'));
      const directorRole = reader.listBy('roles', 'tenantId', organization.id).find(role => role.presetKey === RolePresetKey.DIRECTOR);
      const directorMemberships = reader
        .listBy('memberships', 'organizationId', organization.id)
        .filter((membership: Membership) => membership.roleAssignments.some(assignment => assignment.roleId === directorRole?.id));

      expect([...(directorRole?.permissions ?? [])].sort(), organization.name).toEqual([...expected].sort());
      expect(directorRole?.permissions, organization.name).toContain('member_manage');
      expect(directorMemberships, organization.name).toHaveLength(1);
      expect(directorMemberships[0]?.roleAssignments).toHaveLength(1);
      expect(directorMemberships[0]?.roleAssignments[0]?.warehouseIds).toEqual([]);
    }
  });

  it('gives each customer a storekeeper scoped to one warehouse of that customer', () => {
    const reader = createSeedReader();

    for (const [organizationId, warehouseId, roleId, userId] of [
      [SeedOrganizationId.CUSTOMER_1, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1, SeedRoleId.STOREKEEPER_CUSTOMER_1, SeedUserId.STOREKEEPER_1],
      [SeedOrganizationId.CUSTOMER_2, SeedWarehouseId.CUSTOMER_2_SITE_1, SeedRoleId.STOREKEEPER_CUSTOMER_2, SeedUserId.STOREKEEPER_2],
    ] as const) {
      const role = reader.get('roles', roleId);
      const membership = reader.listBy('memberships', 'userId', userId)[0];

      expect(role).toMatchObject({ name: 'Кладовщик', presetKey: RolePresetKey.STOREKEEPER, tenantId: organizationId });
      expect(role?.permissions).toEqual([
        'inventory_edit',
        'inventory_view',
        'sensor_view',
        'task_edit',
        'task_view',
        'warehouse_view',
        'yard_view',
      ]);
      expect(membership?.organizationId).toBe(organizationId);
      expect(membership?.roleAssignments).toHaveLength(1);
      expect(membership?.roleAssignments[0]?.roleId).toBe(roleId);
      expect(membership?.roleAssignments[0]?.warehouseIds).toEqual([warehouseId]);
      expect(reader.get('warehouses', warehouseId)?.tenantId).toBe(organizationId);
    }
  });

  it('names the people with a fictional first and last name, all different', () => {
    const names = createSeedReader().list('users').map(user => user.displayName);

    expect(names).toHaveLength(11);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((name) => {
      expect(name).toMatch(/^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+$/);
    });
  });

  it('names each person by the seed table', () => {
    const reader = createSeedReader();

    expect(reader.get('users', SeedUserId.ADMIN_1)?.displayName).toBe('Анна Смирнова');
    expect(reader.get('users', SeedUserId.ADMIN_2)?.displayName).toBe('Сергей Кузнецов');
    expect(reader.get('users', SeedUserId.ADMIN_3)?.displayName).toBe('Ольга Попова');
    expect(reader.get('users', SeedUserId.ADMIN_4)?.displayName).toBe('Дмитрий Васильев');
    expect(reader.get('users', SeedUserId.ADMIN_5)?.displayName).toBe('Елена Морозова');
    expect(reader.get('users', SeedUserId.ADMIN_6)?.displayName).toBe('Андрей Новиков');
    expect(reader.get('users', SeedUserId.ADMIN_7)?.displayName).toBe('Татьяна Фёдорова');
    expect(reader.get('users', SeedUserId.ADMIN_8)?.displayName).toBe('Павел Волков');
    expect(reader.get('users', SeedUserId.ADMIN_9)?.displayName).toBe('Наталья Козлова');
    expect(reader.get('users', SeedUserId.STOREKEEPER_1)?.displayName).toBe('Иван Соколов');
    expect(reader.get('users', SeedUserId.STOREKEEPER_2)?.displayName).toBe('Мария Лебедева');
  });

  it('puts the first four personas into the fresh group and the last four into the construction group', () => {
    const personas = createSeedReader().list('personas');

    expect(personas.map(persona => persona.group)).toEqual([
      DemoPersonaGroup.FRESH,
      DemoPersonaGroup.FRESH,
      DemoPersonaGroup.FRESH,
      DemoPersonaGroup.FRESH,
      DemoPersonaGroup.CONSTRUCTION,
      DemoPersonaGroup.CONSTRUCTION,
      DemoPersonaGroup.CONSTRUCTION,
      DemoPersonaGroup.CONSTRUCTION,
    ]);
  });

  it('gives each vertical a customer, a supplier, a carrier and a storekeeper persona', () => {
    const reader = createSeedReader();
    const personas = reader.list('personas');

    expect(personas).toHaveLength(8);
    expect(personas.filter(persona => persona.kind === DemoPersonaKind.CUSTOMER)).toHaveLength(2);
    expect(personas.filter(persona => persona.kind === DemoPersonaKind.SUPPLIER)).toHaveLength(2);
    expect(personas.filter(persona => persona.kind === DemoPersonaKind.CARRIER)).toHaveLength(2);
    expect(personas.filter(persona => persona.kind === DemoPersonaKind.STOREKEEPER)).toHaveLength(2);
    expect(reader.get('personas', SeedPersonaId.FRESH_CUSTOMER)?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
  });

  it('points every persona to a member of the persona organization', () => {
    const reader = createSeedReader();

    for (const persona of reader.list('personas')) {
      const memberships = reader.listBy('memberships', 'userId', persona.userId);

      expect(memberships.map(membership => membership.organizationId), persona.id).toContain(persona.organizationId);
      expect(reader.get('organizations', persona.organizationId), persona.id).toBeDefined();
    }
  });
});
