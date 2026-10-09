import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { ProfileSummaryValue } from '../model/profileSummaryTypes';

export const selectProfileSummary = (session: GetSessionResponse): ProfileSummaryValue | undefined => {
  const { user } = session;
  const actingOrganization = session.organizations.find(organization => organization.id === session.actingOrganizationId);

  if (user === undefined || actingOrganization === undefined) {
    return undefined;
  }

  return {
    organizationId: actingOrganization.id,
    organizationName: actingOrganization.name,
    sides: actingOrganization.profiles.map(profile => profile.kind).filter(kind => kind !== ProfileKind.UNSPECIFIED),
    userDisplayName: user.displayName,
    userId: user.id,
  };
};
