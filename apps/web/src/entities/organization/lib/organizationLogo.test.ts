import { create } from '@bufbuild/protobuf';
import { OrganizationLogoSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { toOrganizationLogo } from './organizationLogo';

const LOGO = { darkPath: 'logos/customer-1-dark.svg', lightPath: 'logos/customer-1-light.svg' };

describe('toOrganizationLogo', () => {
  it('returns nothing without a message', () => {
    expect(toOrganizationLogo(undefined)).toBeUndefined();
  });

  it('returns nothing when both paths are empty', () => {
    expect(toOrganizationLogo(create(OrganizationLogoSchema))).toBeUndefined();
  });

  it('maps both variants', () => {
    const logo = create(OrganizationLogoSchema, { darkUrl: LOGO.darkPath, lightUrl: LOGO.lightPath });

    expect(toOrganizationLogo(logo)).toEqual(LOGO);
  });

  it('keeps a logo that has only one variant', () => {
    const logo = create(OrganizationLogoSchema, { lightUrl: LOGO.lightPath });

    expect(toOrganizationLogo(logo)).toEqual({ darkPath: '', lightPath: LOGO.lightPath });
  });
});
