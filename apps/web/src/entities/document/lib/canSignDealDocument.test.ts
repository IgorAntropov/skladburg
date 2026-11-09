import { create } from '@bufbuild/protobuf';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentSchema,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { canSignDealDocument } from './canSignDealDocument';

const deal = create(DealSchema, {
  customerOrganizationId: 'customer',
  id: 'current-deal',
  status: DealStatus.LOGISTICS_CHOSEN,
  supplierOrganizationId: 'supplier',
});
const contract = create(DocumentSchema, {
  dealId: 'first-deal',
  issuerOrganizationId: 'supplier',
  status: DocumentStatus.DRAFT,
  type: DocumentType.SUPPLY_CONTRACT,
});

describe('canSignDealDocument', () => {
  it('allows the supplier to sign a draft contract shared by the current deal', () => {
    expect(canSignDealDocument(deal, contract, 'supplier')).toBe(true);
    expect(canSignDealDocument(deal, contract, 'customer')).toBe(false);
  });

  it('allows the customer to countersign the issued document', () => {
    const approved = { ...contract, status: DocumentStatus.APPROVED };

    expect(canSignDealDocument(deal, approved, 'customer')).toBe(true);
    expect(canSignDealDocument(deal, approved, 'supplier')).toBe(false);
    expect(canSignDealDocument(deal, approved, 'carrier')).toBe(false);
    expect(canSignDealDocument(deal, approved, undefined)).toBe(false);
  });

  it('disallows signing when the document or the deal has moved on', () => {
    expect(canSignDealDocument(deal, { ...contract, status: DocumentStatus.SIGNED }, 'customer')).toBe(false);
    expect(canSignDealDocument(deal, { ...contract, status: DocumentStatus.ANNULLED }, 'supplier')).toBe(false);
    expect(canSignDealDocument({ ...deal, status: DealStatus.CANCELLED }, contract, 'supplier')).toBe(false);
  });
});
