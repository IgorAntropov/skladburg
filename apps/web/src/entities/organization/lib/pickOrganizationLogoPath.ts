import type {
  OrganizationLogoBackgroundValue,
  OrganizationLogoValue,
} from './organizationLogo';

export const pickOrganizationLogoPath = (
  logo: OrganizationLogoValue | undefined,
  background: OrganizationLogoBackgroundValue,
): string | undefined => {
  if (logo === undefined) {
    return undefined;
  }

  const paths = background === 'dark' ? [logo.darkPath, logo.lightPath] : [logo.lightPath, logo.darkPath];

  return paths.find(path => path !== '');
};
