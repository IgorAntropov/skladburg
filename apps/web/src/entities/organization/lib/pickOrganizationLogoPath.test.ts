import {
  describe,
  expect,
  it,
} from 'vitest';

import { pickOrganizationLogoPath } from './pickOrganizationLogoPath';

const LOGO = { darkPath: 'logos/customer-1-dark.svg', lightPath: 'logos/customer-1-light.svg' };

describe('pickOrganizationLogoPath', () => {
  it('picks the variant for the background', () => {
    expect(pickOrganizationLogoPath(LOGO, 'light')).toBe(LOGO.lightPath);
    expect(pickOrganizationLogoPath(LOGO, 'dark')).toBe(LOGO.darkPath);
  });

  it('falls back to the other variant when the preferred one is empty', () => {
    expect(pickOrganizationLogoPath({ darkPath: '', lightPath: LOGO.lightPath }, 'dark')).toBe(LOGO.lightPath);
    expect(pickOrganizationLogoPath({ darkPath: LOGO.darkPath, lightPath: '' }, 'light')).toBe(LOGO.darkPath);
  });

  it('returns nothing without a logo or with both variants empty', () => {
    expect(pickOrganizationLogoPath(undefined, 'light')).toBeUndefined();
    expect(pickOrganizationLogoPath({ darkPath: '', lightPath: '' }, 'dark')).toBeUndefined();
  });
});
