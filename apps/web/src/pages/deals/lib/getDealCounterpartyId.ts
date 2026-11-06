import type { Deal } from '@skladburg/contracts/deal/v1/deal';

export const getDealCounterpartyId = (deal: Deal, organizationId: string): string => (
  organizationId === deal.customerOrganizationId ? deal.supplierOrganizationId : deal.customerOrganizationId
);
