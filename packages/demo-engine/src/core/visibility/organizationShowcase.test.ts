import { create } from '@bufbuild/protobuf';
import {
  OrganizationLogoSchema,
  OrganizationSchema,
  ProfileKind,
  SphereSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { OrganizationShowcaseSchema } from '@skladburg/contracts/organization/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createTestRuntime } from '../modules/testing/testRuntime';
import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedSphereId,
} from '../seed/index';
import { createEngineState } from '../state/index';
import {
  collectSphereSubtreeIds,
  getVisibleOrganizationShowcase,
  listVisibleOrganizationShowcases,
  type OrganizationShowcaseFilterValue,
  projectOrganizationShowcase,
} from './organizationShowcase';

const { read } = createEngineState(createSeedSnapshot());
const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const REQUISITE_FIELD_NAMES = ['legal_name', 'inn', 'kpp', 'ogrn'];
const NO_FILTER: OrganizationShowcaseFilterValue = {
  minVerificationLevel: 0,
  profileKind: ProfileKind.UNSPECIFIED,
  sphereId: '',
};

const listNames = (viewerOrganizationId: string, filter: Partial<OrganizationShowcaseFilterValue> = {}): string[] =>
  listVisibleOrganizationShowcases(read, viewerOrganizationId, { ...NO_FILTER, ...filter }).map(showcase => showcase.name);

describe('projectOrganizationShowcase', () => {
  it('has only the fields of the showcase schema and none of the legal requisites', () => {
    const organization = read.get('organizations', SeedOrganizationId.SUPPLIER_4);

    expect(organization).toBeDefined();

    const projection = projectOrganizationShowcase(create(OrganizationSchema, organization));
    const schemaFieldNames = OrganizationShowcaseSchema.fields.map(field => field.name);

    expect(projection.$typeName).toBe(OrganizationShowcaseSchema.typeName);
    expect(schemaFieldNames.filter(name => REQUISITE_FIELD_NAMES.includes(name))).toEqual([]);
  });

  it('copies the id, the name, the profiles and the spheres', () => {
    const organization = read.get('organizations', SeedOrganizationId.SUPPLIER_4);
    const projection = projectOrganizationShowcase(create(OrganizationSchema, organization));

    expect(projection.id).toBe(SeedOrganizationId.SUPPLIER_4);
    expect(projection.name).toBe('Поставщик 4');
    expect(projection.profiles.map(profile => [profile.kind, profile.verificationLevel])).toEqual([
      [ProfileKind.SUPPLIER, 2],
      [ProfileKind.CARRIER, 0],
    ]);
    expect(projection.sphereIds).toEqual([SeedSphereId.CEMENT_AND_CONCRETE, SeedSphereId.TIMBER]);
  });

  it('copies the logo of the organization without sharing the object', () => {
    const organization = read.get('organizations', SeedOrganizationId.SUPPLIER_4);
    const projection = projectOrganizationShowcase(create(OrganizationSchema, organization));

    expect(projection.logo?.lightUrl).toBe('logos/supplier-4-light.svg');
    expect(projection.logo?.darkUrl).toBe('logos/supplier-4-dark.svg');
    expect(projection.logo).not.toBe(organization?.logo);
  });

  it('has no logo when the organization has none', () => {
    expect(projectOrganizationShowcase(create(OrganizationSchema)).logo).toBeUndefined();
  });

  it('keeps the logo urls as they are stored', () => {
    const organization = create(OrganizationSchema, {
      logo: create(OrganizationLogoSchema, { darkUrl: '', lightUrl: 'light.svg' }),
    });

    expect(projectOrganizationShowcase(organization).logo).toEqual(organization.logo);
  });

  it('does not share the profile objects with the source', () => {
    const organization = create(OrganizationSchema, { profiles: [{ kind: ProfileKind.CUSTOMER, verificationLevel: 2 }] });
    const projection = projectOrganizationShowcase(organization);

    expect(projection.profiles[0]).not.toBe(organization.profiles[0]);
    expect(projection.profiles[0]).toEqual(organization.profiles[0]);
  });
});

describe('collectSphereSubtreeIds', () => {
  const spheres = read.list('spheres');

  it('includes the node itself and all its descendants', () => {
    expect([...collectSphereSubtreeIds(spheres, SeedSphereId.FOOD)].sort()).toEqual([
      SeedSphereId.DAIRY,
      SeedSphereId.FOOD,
      SeedSphereId.FRUIT_AND_VEGETABLES,
      SeedSphereId.MEAT_AND_POULTRY,
    ].sort());
  });

  it('is only the node itself for a leaf', () => {
    expect([...collectSphereSubtreeIds(spheres, SeedSphereId.DAIRY)]).toEqual([SeedSphereId.DAIRY]);
  });

  it('is empty for an unknown sphere', () => {
    expect(collectSphereSubtreeIds(spheres, UNKNOWN_ID).size).toBe(0);
  });

  it('walks nested levels and survives a cycle', () => {
    const chain = [
      create(SphereSchema, { id: 'a', parentId: 'c' }),
      create(SphereSchema, { id: 'b', parentId: 'a' }),
      create(SphereSchema, { id: 'c', parentId: 'b' }),
      create(SphereSchema, { id: 'd', parentId: 'c' }),
    ];

    expect([...collectSphereSubtreeIds(chain, 'b')].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('listVisibleOrganizationShowcases', () => {
  it('lists every verified organization to a verified viewer and hides the unverified one', () => {
    const names = listNames(SeedOrganizationId.CUSTOMER_1);

    expect(names).toHaveLength(8);
    expect(names).not.toContain('Поставщик 5');
  });

  it('puts the own organization among the others without raising it', () => {
    const names = listNames(SeedOrganizationId.SUPPLIER_3);

    expect(names).toEqual([...names].sort(new Intl.Collator('ru').compare));
    expect(names.indexOf('Поставщик 3')).toBeGreaterThan(0);
  });

  it('shows an unverified viewer only its own organization', () => {
    expect(listNames(SeedOrganizationId.SUPPLIER_5)).toEqual(['Поставщик 5']);
  });

  it('applies the filter to the own organization of an unverified viewer too', () => {
    expect(listNames(SeedOrganizationId.SUPPLIER_5, { minVerificationLevel: 1 })).toEqual([]);
  });

  it('shows nothing to a viewer that does not exist', () => {
    expect(listNames(UNKNOWN_ID)).toEqual([]);
  });

  it('finds the subtree of a sphere including the node itself, but not the other way round', () => {
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { sphereId: SeedSphereId.FOOD }))
      .toEqual(['Заказчик 1', 'Перевозчик 1', 'Поставщик 1', 'Поставщик 2']);
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { sphereId: SeedSphereId.DAIRY })).toEqual(['Поставщик 1']);
  });

  it('does not find an organization with the root sphere by a branch of it', () => {
    const names = listNames(SeedOrganizationId.CUSTOMER_1, { sphereId: SeedSphereId.DAIRY });

    expect(names).not.toContain('Заказчик 1');
    expect(names).not.toContain('Перевозчик 1');
  });

  it('returns nothing for an unknown sphere', () => {
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { sphereId: UNKNOWN_ID })).toEqual([]);
  });

  it('filters by side', () => {
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { profileKind: ProfileKind.CARRIER }))
      .toEqual(['Перевозчик 1', 'Перевозчик 2', 'Поставщик 4']);
  });

  it('filters by the level not lower than N', () => {
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { minVerificationLevel: 3 }))
      .toEqual(['Перевозчик 2', 'Поставщик 2', 'Поставщик 3']);
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { minVerificationLevel: 4 })).toEqual([]);
  });

  it('checks the side and the level on the same profile', () => {
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { minVerificationLevel: 1, profileKind: ProfileKind.CARRIER }))
      .toEqual(['Перевозчик 1', 'Перевозчик 2']);
    expect(listNames(SeedOrganizationId.CUSTOMER_1, { minVerificationLevel: 2, profileKind: ProfileKind.SUPPLIER }))
      .toContain('Поставщик 4');
  });

  it('does not filter by the side and the level when they are zero', () => {
    const unfiltered = listNames(SeedOrganizationId.CUSTOMER_1);

    expect(listNames(SeedOrganizationId.CUSTOMER_1, { minVerificationLevel: 0, profileKind: ProfileKind.UNSPECIFIED })).toEqual(unfiltered);
  });

  it('combines the sphere, the side and the level', () => {
    expect(listNames(SeedOrganizationId.CUSTOMER_1, {
      minVerificationLevel: 1,
      profileKind: ProfileKind.CARRIER,
      sphereId: SeedSphereId.FOOD,
    })).toEqual(['Перевозчик 1']);
  });

  it('sorts by the name with the Russian collation, then by the id', async () => {
    const { runtime } = createTestRuntime();
    const first = '10000000-0000-4000-8000-000000000001';
    const second = '10000000-0000-4000-8000-000000000002';
    const third = '10000000-0000-4000-8000-000000000003';
    const profiles = [{ kind: ProfileKind.SUPPLIER, verificationLevel: 1 }];

    await runtime.command((transaction) => {
      transaction.put('organizations', create(OrganizationSchema, { id: second, name: 'Ёлка', profiles }));
      transaction.put('organizations', create(OrganizationSchema, { id: first, name: 'ёлка', profiles }));
      transaction.put('organizations', create(OrganizationSchema, { id: third, name: 'Ель', profiles }));
    });

    const addedIds = new Set([first, second, third]);
    const sortedIds = listVisibleOrganizationShowcases(runtime.read, first, NO_FILTER)
      .filter(showcase => addedIds.has(showcase.id))
      .map(showcase => showcase.id);

    expect(sortedIds).toEqual([first, second, third]);
  });
});

describe('getVisibleOrganizationShowcase', () => {
  it('returns the projection of the own and of another verified organization', () => {
    expect(getVisibleOrganizationShowcase(read, SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.CUSTOMER_1)?.name).toBe('Заказчик 1');
    expect(getVisibleOrganizationShowcase(read, SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.SUPPLIER_2)?.name).toBe('Поставщик 2');
  });

  it('returns the own organization of an unverified viewer', () => {
    expect(getVisibleOrganizationShowcase(read, SeedOrganizationId.SUPPLIER_5, SeedOrganizationId.SUPPLIER_5)?.name).toBe('Поставщик 5');
  });

  it('hides an unverified organization from others and others from an unverified viewer', () => {
    expect(getVisibleOrganizationShowcase(read, SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.SUPPLIER_5)).toBeUndefined();
    expect(getVisibleOrganizationShowcase(read, SeedOrganizationId.SUPPLIER_5, SeedOrganizationId.CUSTOMER_1)).toBeUndefined();
  });

  it('returns nothing for an organization that does not exist', () => {
    expect(getVisibleOrganizationShowcase(read, SeedOrganizationId.CUSTOMER_1, UNKNOWN_ID)).toBeUndefined();
  });
});
