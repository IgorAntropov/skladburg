import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { clone } from '@bufbuild/protobuf';
import { DealSchema } from '@skladburg/contracts/deal/v1/deal';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

export const projectDeal = (deal: Deal, organizationId: string): Deal => {
  const projected = clone(DealSchema, deal);
  const ownSide = deal.customerOrganizationId === organizationId ? ProfileKind.CUSTOMER : ProfileKind.SUPPLIER;
  for (const transition of projected.transitions) {
    if (transition.actorSide !== ownSide) {
      transition.actorRoleName = '';
    }
  }
  return projected;
};
