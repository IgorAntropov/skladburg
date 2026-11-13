import type { MessageInitShape } from '@bufbuild/protobuf';
import type {
  Deal,
  ReceiptLineComparison,
} from '@skladburg/contracts/deal/v1/deal';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  type Document,
  DocumentContentSchema,
  DocumentSchema,
  DocumentSignatureSchema,
  DocumentStatus,
  DocumentType,
  SignatureLevel,
} from '@skladburg/contracts/document/v1/document';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { PermissionCallerValue } from '../../access/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { dealActorRoleName } from '../deals/dealAccess';
import {
  MAX_DEAL_INTEGER,
  rub,
} from '../deals/dealRules';
import { readDocumentParty } from './dealDocuments';
import { assignDocumentNumber } from './documentNumbers';
import { sha256 } from './sha256';

interface ReceiptDocumentInputValue {
  caller?: PermissionCallerValue | undefined;
  isCustomerIssuer: boolean;
  issuedAtMs?: number | undefined;
  terms: MessageInitShape<typeof DocumentContentSchema>['terms'];
  type: DocumentType;
}

type ReceiptDocumentRuntimeValue = Pick<IModuleRuntime, 'errors' | 'random'>;

export const readReceiptDocument = (reader: IStateReader, dealId: string, type: DocumentType): Document | undefined =>
  reader.listBy('documents', 'dealId', dealId).find(document => document.type === type);

const issueReceiptDocument = (
  transaction: IStateTransaction,
  runtime: ReceiptDocumentRuntimeValue,
  deal: Deal,
  input: ReceiptDocumentInputValue,
): Document => {
  const { caller, isCustomerIssuer, issuedAtMs, terms, type } = input;
  if (readReceiptDocument(transaction, deal.id, type) !== undefined) {
    throw runtime.errors.internal();
  }

  const invoice = readReceiptDocument(transaction, deal.id, DocumentType.INVOICE);
  const customer = invoice?.content?.customer ?? readDocumentParty(runtime, transaction, deal.customerOrganizationId);
  const supplier = invoice?.content?.supplier ?? readDocumentParty(runtime, transaction, deal.supplierOrganizationId);
  const content = create(DocumentContentSchema, { customer, supplier, terms });
  const document = create(DocumentSchema, {
    content,
    contractId: deal.contractId,
    dealId: deal.id,
    id: runtime.random.uuid(),
    issuerOrganizationId: isCustomerIssuer ? deal.customerOrganizationId : deal.supplierOrganizationId,
    requiredSides: caller === undefined ? [] : [ProfileKind.CUSTOMER],
    status: caller === undefined ? DocumentStatus.APPROVED : DocumentStatus.SIGNED,
    type,
    version: 1,
  });
  assignDocumentNumber(runtime.errors, transaction, document, issuedAtMs);
  if (caller !== undefined) {
    document.signatures.push(create(DocumentSignatureSchema, {
      contentSha256: sha256(toBinary(DocumentContentSchema, content, { writeUnknownFields: false })),
      level: SignatureLevel.INTERNAL,
      organizationId: caller.organizationId,
      side: ProfileKind.CUSTOMER,
      signedAt: timestampFromMs(transaction.worldTimeMs),
      signerDisplayName: caller.user.displayName,
      signerRoleName: dealActorRoleName(transaction, caller),
      signerUserId: caller.user.id,
    }));
  }
  transaction.put('documents', document);
  return document;
};

export const issueInboundDocuments = (
  transaction: IStateTransaction,
  runtime: ReceiptDocumentRuntimeValue,
  deal: Deal,
  task: ReceivingTask,
  restoredShipmentAtMs?: number,
): void => {
  const quantities = new Map<string, bigint>();
  for (const unit of task.expectedUnits) {
    for (const batch of unit.batches) {
      const quantity = (quantities.get(batch.dealLineId) ?? 0n) + batch.quantityBase;
      quantities.set(batch.dealLineId, quantity > MAX_DEAL_INTEGER ? MAX_DEAL_INTEGER : quantity);
    }
  }
  const upd = issueReceiptDocument(transaction, runtime, deal, {
    isCustomerIssuer: false,
    issuedAtMs: restoredShipmentAtMs,
    terms: {
      case: 'upd',
      value: { lines: task.orderLines.map(line => ({
        dealLineId: line.dealLineId,
        productName: line.productName,
        quantityBase: quantities.get(line.dealLineId) ?? 0n,
      })) },
    },
    type: DocumentType.UPD,
  });
  issueReceiptDocument(transaction, runtime, deal, {
    isCustomerIssuer: false,
    issuedAtMs: restoredShipmentAtMs,
    terms: { case: 'dispatchTitle', value: { shippedAt: timestampFromMs(restoredShipmentAtMs ?? transaction.worldTimeMs),
      updDocumentId: upd.id } },
    type: DocumentType.DISPATCH_TITLE,
  });
  task.updDocumentId = upd.id;
  if (restoredShipmentAtMs === undefined) {
    task.sourceDocumentNumber = upd.displayNumber;
  }
};

export const issueReceiptDiscrepancyAct = (
  transaction: IStateTransaction,
  runtime: ReceiptDocumentRuntimeValue,
  deal: Deal,
  task: ReceivingTask,
  lines: readonly ReceiptLineComparison[],
  issuedAtMs?: number,
): Document => issueReceiptDocument(transaction, runtime, deal, {
  isCustomerIssuer: true,
  issuedAtMs,
  terms: {
    case: 'receiptDiscrepancyAct',
    value: { finishedAt: task.finishedAt, lines: [...lines], updDocumentId: task.updDocumentId },
  },
  type: DocumentType.RECEIPT_DISCREPANCY_ACT,
});

export const issueReceiptClaim = (
  transaction: IStateTransaction,
  runtime: ReceiptDocumentRuntimeValue,
  deal: Deal,
  act: Document,
  acceptedGoodsMinor: bigint,
): Document => {
  if (deal.goodsTotal === undefined || acceptedGoodsMinor > deal.goodsTotal.amountMinor) {
    throw runtime.errors.internal();
  }
  return issueReceiptDocument(transaction, runtime, deal, {
    isCustomerIssuer: true,
    terms: {
      case: 'receiptClaim',
      value: { discrepancyActDocumentId: act.id, disputedGoodsAmount: rub(deal.goodsTotal.amountMinor - acceptedGoodsMinor) },
    },
    type: DocumentType.RECEIPT_CLAIM,
  });
};

export const signReceiptTitle = (
  transaction: IStateTransaction,
  runtime: ReceiptDocumentRuntimeValue,
  deal: Deal,
  task: ReceivingTask,
  lines: readonly ReceiptLineComparison[],
  caller: PermissionCallerValue,
): Document => issueReceiptDocument(transaction, runtime, deal, {
  caller,
  isCustomerIssuer: true,
  terms: {
    case: 'receiptTitle',
    value: { finishedAt: task.finishedAt, lines: [...lines], updDocumentId: task.updDocumentId },
  },
  type: DocumentType.RECEIPT_TITLE,
});
