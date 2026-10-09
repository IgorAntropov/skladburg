import {
  AccessService,
  type Membership,
} from '@skladburg/contracts/access/v1/access';
import {
  OrganizationService,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import { listPermissionNames } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { ENGINE_COLLECTION_NAMES } from '../ports/index';
import {
  createEngineState,
  DemoPersonaGroup,
  DemoPersonaKind,
  ENGINE_SCHEMA_VERSION,
  type IStateReader,
} from '../state/index';
import {
  ADMIN_PRESET_KEY,
  STOREKEEPER_PRESET_KEY,
} from './seedAccess';
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
      expect(reader.get('boardNodes', warehouse.boardNodeId)?.cityId).toBe(warehouse.cityId);
      expect(reader.get('organizations', warehouse.tenantId)).toBeDefined();
      expect(reader.get('cities', warehouse.cityId)?.timeZone).toBe(warehouse.timeZone);
    }

    for (const organization of reader.list('organizations')) {
      organization.sphereIds.forEach((sphereId) => {
        expect(reader.get('spheres', sphereId)).toBeDefined();
      });
    }
  });

  it('places board nodes on distinct grid cells', () => {
    const cells = createSeedReader().list('boardNodes').map(node => `${String(node.position?.column)}:${String(node.position?.row)}`);

    expect(new Set(cells).size).toBe(cells.length);
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

  it('gives every organization an administrator with the full permission catalog', () => {
    const reader = createSeedReader();
    const catalog = listPermissionNames([AccessService, OrganizationService]);

    for (const organization of reader.list('organizations')) {
      const roles = reader.listBy('roles', 'tenantId', organization.id);
      const adminRole = roles.find(role => role.presetKey === ADMIN_PRESET_KEY);
      const adminMemberships = reader
        .listBy('memberships', 'organizationId', organization.id)
        .filter((membership: Membership) => membership.roleAssignments.some(assignment => assignment.roleId === adminRole?.id));

      expect(adminRole?.permissions, organization.name).toEqual(catalog);
      expect(adminMemberships, organization.name).toHaveLength(1);
      expect(adminMemberships[0]?.roleAssignments[0]?.warehouseIds).toEqual([]);
    }

    expect(catalog).toContain('warehouse_create');
  });

  it('gives each customer a storekeeper scoped to one warehouse of that customer', () => {
    const reader = createSeedReader();

    for (const [organizationId, warehouseId, roleId, userId] of [
      [SeedOrganizationId.CUSTOMER_1, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1, SeedRoleId.STOREKEEPER_CUSTOMER_1, SeedUserId.STOREKEEPER_1],
      [SeedOrganizationId.CUSTOMER_2, SeedWarehouseId.CUSTOMER_2_SITE_1, SeedRoleId.STOREKEEPER_CUSTOMER_2, SeedUserId.STOREKEEPER_2],
    ] as const) {
      const role = reader.get('roles', roleId);
      const membership = reader.listBy('memberships', 'userId', userId)[0];

      expect(role).toMatchObject({ permissions: ['warehouse_view'], presetKey: STOREKEEPER_PRESET_KEY, tenantId: organizationId });
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
