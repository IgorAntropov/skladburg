import type { IDomainErrors } from '../../errors/index';

import { readActingContext } from '../../context/index';

export const resolveNotificationCommandOrganizationId = (headers: Headers, errors: IDomainErrors): string => {
  const { organizationId } = readActingContext(headers);

  if (organizationId === undefined) {
    throw errors.membershipRequired();
  }

  return organizationId;
};
