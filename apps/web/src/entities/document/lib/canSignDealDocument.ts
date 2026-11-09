import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { Document } from '@skladburg/contracts/document/v1/document';

import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DocumentStatus } from '@skladburg/contracts/document/v1/document';

export const canSignDealDocument = (deal: Deal, document: Document, organizationId: string | undefined): boolean => {
  if (deal.status !== DealStatus.LOGISTICS_CHOSEN || organizationId === undefined) {
    return false;
  }

  return organizationId === document.issuerOrganizationId
    ? organizationId === deal.supplierOrganizationId && document.status === DocumentStatus.DRAFT
    : organizationId === deal.customerOrganizationId && document.status === DocumentStatus.APPROVED;
};
