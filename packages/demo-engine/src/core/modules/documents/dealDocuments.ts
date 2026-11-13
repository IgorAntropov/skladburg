import type { MessageInitShape } from '@bufbuild/protobuf';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  type Document,
  DocumentContentSchema,
  type DocumentParty,
  DocumentPartySchema,
  DocumentSchema,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

export const readDocumentParty = (runtime: Pick<IModuleRuntime, 'errors'>, reader: IStateReader, organizationId: string): DocumentParty => {
  const organization = reader.get('organizations', organizationId);
  if (organization === undefined) {
    throw runtime.errors.notFound(EntityKind.ORGANIZATION);
  }
  const requisites = reader.get('organizationRequisites', organizationId);
  return create(DocumentPartySchema, {
    bank: requisites?.bank,
    inn: organization.inn,
    kpp: organization.kpp,
    legalAddress: requisites?.legalAddress,
    legalName: organization.legalName || organization.name,
    ogrn: organization.ogrn,
    organizationId,
    signatory: requisites?.signatories.find(signatory => signatory.isDefault),
    vatMode: requisites?.vatMode,
  });
};

const readDealSpecificDocuments = (reader: IStateReader, deal: Deal): Document[] =>
  reader.listBy('documents', 'dealId', deal.id).filter(document => document.type !== DocumentType.SUPPLY_CONTRACT);

export const readDealDocuments = (reader: IStateReader, deal: Deal): Document[] => {
  const documents = readDealSpecificDocuments(reader, deal);
  const contractId = reader.get('supplyContracts', deal.contractId)?.documentId;
  const contract = contractId === undefined ? undefined : reader.get('documents', contractId);
  if (contract !== undefined) {
    documents.unshift(contract);
  }
  return documents.sort((current, prev) => current.type - prev.type);
};

export const issueDealDocuments = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  const contract = transaction.get('supplyContracts', deal.contractId);
  const { deliveryTotal, goodsTotal } = deal;
  if (contract === undefined || goodsTotal === undefined || deliveryTotal === undefined) {
    throw runtime.errors.internal();
  }

  const parties = {
    customer: readDocumentParty(runtime, transaction, deal.customerOrganizationId),
    supplier: readDocumentParty(runtime, transaction, deal.supplierOrganizationId),
  };
  const issue = (type: DocumentType, terms: MessageInitShape<typeof DocumentContentSchema>['terms']): Document => {
    const document = create(DocumentSchema, {
      content: create(DocumentContentSchema, { ...parties, terms }),
      contractId: deal.contractId,
      dealId: deal.id,
      id: runtime.random.uuid(),
      issuerOrganizationId: deal.supplierOrganizationId,
      requiredSides: [ProfileKind.SUPPLIER, ProfileKind.CUSTOMER],
      status: DocumentStatus.DRAFT,
      type,
      version: 1,
    });
    transaction.put('documents', document);
    return document;
  };

  if (contract.documentId === '') {
    const document = issue(DocumentType.SUPPLY_CONTRACT, {
      case: 'supplyContract',
      value: {
        acceptanceTerms: contract.acceptanceTerms,
        paymentTerms: contract.paymentTerms,
        templateVersion: contract.templateVersion,
      },
    });
    transaction.put('supplyContracts', { ...contract, documentId: document.id });
  }

  issue(DocumentType.SPECIFICATION, {
    case: 'specification',
    value: {
      deliveryMethod: deal.deliveryMethod,
      deliveryTotal,
      desiredDate: deal.desiredDate,
      goodsTotal,
      lines: deal.lines,
      shipFromWarehouseId: deal.shipFromWarehouseId,
      shipToWarehouseId: deal.shipToWarehouseId,
    },
  });
  issue(DocumentType.INVOICE, {
    case: 'invoice',
    value: {
      deliveryTotal,
      goodsTotal,
      lines: deal.lines,
      total: create(MoneySchema, {
        amountMinor: goodsTotal.amountMinor + deliveryTotal.amountMinor,
        currencyCode: goodsTotal.currencyCode,
      }),
    },
  });
};

export const annulDealDocuments = (transaction: IStateTransaction, deal: Deal): void => {
  for (const document of readDealSpecificDocuments(transaction, deal)) {
    transaction.put('documents', { ...document, status: DocumentStatus.ANNULLED, version: document.version + 1 });
  }
};

export const restoreDealDocuments = (runtime: IModuleRuntime, deals: readonly Deal[]): Promise<void> =>
  runtime.command((transaction) => {
    for (const deal of deals) {
      issueDealDocuments(runtime, transaction, deal);
    }
  });
