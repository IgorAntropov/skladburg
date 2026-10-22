import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

export interface OrganizationDirectoryFilterValue {
  minVerificationLevel: number;
  profileKind: ProfileKind;
  sphereId: string;
}

export const DEFAULT_ORGANIZATION_DIRECTORY_FILTER: OrganizationDirectoryFilterValue = {
  minVerificationLevel: 0,
  profileKind: ProfileKind.UNSPECIFIED,
  sphereId: '',
};
