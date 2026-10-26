import type { OrganizationLogo } from '@skladburg/contracts/organization/v1/organization';

export type OrganizationLogoBackgroundValue = 'dark' | 'light';

export interface OrganizationLogoValue {
  darkPath: string;
  lightPath: string;
}

export const toOrganizationLogo = (logo: OrganizationLogo | undefined): OrganizationLogoValue | undefined => {
  if (logo === undefined || (logo.lightUrl === '' && logo.darkUrl === '')) {
    return undefined;
  }

  return { darkPath: logo.darkUrl, lightPath: logo.lightUrl };
};
