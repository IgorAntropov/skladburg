import type { Deal } from '@skladburg/contracts/deal/v1/deal';

export const isDealVisibleToOrganization = (deal: Deal, organizationId: string): boolean =>
  organizationId === deal.customerOrganizationId
  || (deal.submittedAt !== undefined && organizationId === deal.supplierOrganizationId);
