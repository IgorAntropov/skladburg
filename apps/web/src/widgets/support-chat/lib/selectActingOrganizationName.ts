import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';

export const selectActingOrganizationName = (session: GetSessionResponse): string | undefined => (
  session.organizations.find(organization => organization.id === session.actingOrganizationId)?.name
);
