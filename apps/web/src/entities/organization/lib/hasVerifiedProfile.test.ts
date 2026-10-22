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

import { hasVerifiedProfile } from './hasVerifiedProfile';

const createProfile = (verificationLevel: number): OrganizationProfile => create(
  OrganizationProfileSchema,
  { kind: ProfileKind.SUPPLIER, verificationLevel },
);

describe('hasVerifiedProfile', () => {
  it('is false without profiles', () => {
    expect(hasVerifiedProfile([])).toBe(false);
  });

  it('is false while every profile is at level 0', () => {
    expect(hasVerifiedProfile([createProfile(0), createProfile(0)])).toBe(false);
  });

  it('is true as soon as one profile reaches level 1', () => {
    expect(hasVerifiedProfile([createProfile(0), createProfile(1)])).toBe(true);
  });
});
