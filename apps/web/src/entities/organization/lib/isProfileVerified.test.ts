import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  OrganizationProfileSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { isProfileVerified } from './isProfileVerified';

const createProfile = (kind: ProfileKind, verificationLevel: number): OrganizationProfile => create(
  OrganizationProfileSchema,
  { kind, verificationLevel },
);

describe('isProfileVerified', () => {
  it('is false without profiles', () => {
    expect(isProfileVerified([], ProfileKind.CUSTOMER)).toBe(false);
  });

  it('is false while the profile of the kind is at level 0', () => {
    expect(isProfileVerified([createProfile(ProfileKind.CUSTOMER, 0)], ProfileKind.CUSTOMER)).toBe(false);
  });

  it('is true once the profile of the kind reaches level 1', () => {
    expect(isProfileVerified([createProfile(ProfileKind.CUSTOMER, 1)], ProfileKind.CUSTOMER)).toBe(true);
  });

  it('ignores a verified profile of another kind', () => {
    const profiles = [createProfile(ProfileKind.SUPPLIER, 2), createProfile(ProfileKind.CUSTOMER, 0)];

    expect(isProfileVerified(profiles, ProfileKind.CUSTOMER)).toBe(false);
    expect(isProfileVerified(profiles, ProfileKind.SUPPLIER)).toBe(true);
  });

  it('finds the verified profile among several of the same organization', () => {
    const profiles = [createProfile(ProfileKind.CARRIER, 0), createProfile(ProfileKind.CUSTOMER, 3)];

    expect(isProfileVerified(profiles, ProfileKind.CUSTOMER)).toBe(true);
    expect(isProfileVerified(profiles, ProfileKind.CARRIER)).toBe(false);
  });
});
