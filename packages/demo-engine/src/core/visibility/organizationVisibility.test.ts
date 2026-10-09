import { create } from '@bufbuild/protobuf';
import {
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedSphereId,
} from '../seed/index';
import { createEngineState } from '../state/index';
import {
  getVisibleOrganization,
  isOrganizationVerified,
  projectOrganizationForShowcase,
} from './organizationVisibility';

const { read } = createEngineState(createSeedSnapshot());
const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('isOrganizationVerified', () => {
  it('is true when at least one profile has a verification level of 1 or more', () => {
    const organization = create(OrganizationSchema, {
      profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 0 }, { kind: ProfileKind.CARRIER, verificationLevel: 1 }],
    });

    expect(isOrganizationVerified(organization)).toBe(true);
  });

  it('is false when every profile is unverified or there are no profiles', () => {
    const unverified = create(OrganizationSchema, { profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 0 }] });

    expect(isOrganizationVerified(unverified)).toBe(false);
    expect(isOrganizationVerified(create(OrganizationSchema))).toBe(false);
  });
});

describe('projectOrganizationForShowcase', () => {
  it('keeps the id, the name, the profiles and the spheres and blanks the legal details', () => {
    const organization = read.get('organizations', SeedOrganizationId.SUPPLIER_4);

    expect(organization).toBeDefined();

    const projection = projectOrganizationForShowcase(create(OrganizationSchema, organization));

    expect(projection.id).toBe(SeedOrganizationId.SUPPLIER_4);
    expect(projection.name).toBe('Поставщик 4');
    expect(projection.profiles.map(profile => profile.kind)).toEqual([ProfileKind.SUPPLIER, ProfileKind.CARRIER]);
    expect(projection.sphereIds).toEqual([SeedSphereId.CEMENT_AND_CONCRETE, SeedSphereId.TIMBER]);
    expect([projection.legalName, projection.inn, projection.kpp, projection.ogrn]).toEqual(['', '', '', '']);
  });
});

describe('getVisibleOrganization', () => {
  it('returns the full record of the own organization', () => {
    const organization = getVisibleOrganization(read, SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.CUSTOMER_1);

    expect(organization?.inn).not.toBe('');
  });

  it('returns the own record even when the organization is not verified', () => {
    const organization = getVisibleOrganization(read, SeedOrganizationId.SUPPLIER_5, SeedOrganizationId.SUPPLIER_5);

    expect(organization?.legalName).not.toBe('');
  });

  it('returns the showcase projection of another verified organization to a verified viewer', () => {
    const organization = getVisibleOrganization(read, SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.SUPPLIER_2);

    expect(organization?.id).toBe(SeedOrganizationId.SUPPLIER_2);
    expect(organization?.name).toBe('Поставщик 2');
    expect(organization?.inn).toBe('');
  });

  it('hides another organization that is not verified', () => {
    expect(getVisibleOrganization(read, SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.SUPPLIER_5)).toBeUndefined();
  });

  it('hides every other organization from a viewer that is not verified', () => {
    expect(getVisibleOrganization(read, SeedOrganizationId.SUPPLIER_5, SeedOrganizationId.CUSTOMER_1)).toBeUndefined();
  });

  it('returns nothing for an organization that does not exist', () => {
    expect(getVisibleOrganization(read, SeedOrganizationId.CUSTOMER_1, UNKNOWN_ID)).toBeUndefined();
  });

  it('returns nothing when the viewing organization does not exist', () => {
    expect(getVisibleOrganization(read, UNKNOWN_ID, SeedOrganizationId.CUSTOMER_1)).toBeUndefined();
  });
});
