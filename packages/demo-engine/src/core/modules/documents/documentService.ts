import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type { ServiceImpl } from '@connectrpc/connect';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  type Document,
  DocumentContentSchema,
  DocumentService,
  DocumentSignatureSchema,
  DocumentStatus,
  DocumentType,
  GetDocumentResponseSchema,
  ListDealDocumentsResponseSchema,
  SignatureLevel,
  SignDocumentResponseSchema,
  SignSupplyContractResponseSchema,
} from '@skladburg/contracts/document/v1/document';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  dealActorRoleName,
  readVisibleDeal,
  requireDealPartyProfiles,
} from '../deals/dealAccess';
import { paginate } from '../pagination';
import { readDealDocuments } from './dealDocuments';
import { publishDocumentEffects } from './documentEffects';
import { assignDocumentNumber } from './documentNumbers';
import { sha256 } from './sha256';

interface SignDocumentInputValue<TInput extends DescMessage, TOutput extends DescMessage> {
  headers: Headers;
  isContract: boolean;
  method: DescMethodUnary<TInput, TOutput>;
  request: MessageShape<TInput> & {
    dealId: string;
    documentId: string;
    expectedVersion: number;
    idempotencyKey: string;
  };
  response: (document: Document) => MessageShape<TOutput>;
}

const projectDocument = (document: Document, organizationId: string): Document => ({
  ...document,
  signatures: document.signatures.map(signature => signature.organizationId === organizationId
    ? signature
    : { ...signature, signerRoleName: '', signerUserId: '' }),
});

const readDocument = (runtime: IModuleRuntime, reader: IStateReader, deal: Deal, documentId: string): Document => {
  const document = readDealDocuments(reader, deal).find(candidate => candidate.id === documentId);
  if (document === undefined) {
    throw runtime.errors.notFound(EntityKind.DOCUMENT);
  }
  return document;
};

const signDocument = <TInput extends DescMessage, TOutput extends DescMessage>(
  runtime: IModuleRuntime,
  input: SignDocumentInputValue<TInput, TOutput>,
): Promise<MessageShape<TOutput>> => runtime.command((transaction) => {
  const { headers, isContract, method, request, response } = input;
  const caller = runtime.guard.guardPermissionCall(transaction, method, request, headers);
  const canViewDocument = caller.permissions.some(permission => permission.permission === 'document_view' && permission.isOrganizationWide);
  if (!canViewDocument) {
    throw runtime.errors.permissionDenied('document_view');
  }
  return runtime.idempotency.run(transaction, {
    handler: () => {
      const deal = readVisibleDeal(transaction, runtime.errors, request.dealId, caller);
      const document = readDocument(runtime, transaction, deal, request.documentId);
      if ((document.type === DocumentType.SUPPLY_CONTRACT) !== isContract) {
        throw runtime.errors.permissionDenied(document.type === DocumentType.SUPPLY_CONTRACT ? 'contract_sign' : 'document_sign');
      }
      if (document.version !== request.expectedVersion) {
        throw runtime.errors.versionConflict(EntityKind.DOCUMENT, document.version);
      }

      const isIssuer = caller.organizationId === document.issuerOrganizationId;
      const nextStatus = isIssuer ? DocumentStatus.APPROVED : DocumentStatus.SIGNED;
      const requiredStatus = isIssuer ? DocumentStatus.DRAFT : DocumentStatus.APPROVED;
      if (deal.status !== DealStatus.LOGISTICS_CHOSEN || document.status !== requiredStatus) {
        throw runtime.errors.invalidTransition(EntityKind.DOCUMENT, DocumentStatus[document.status], DocumentStatus[nextStatus]);
      }
      requireDealPartyProfiles(transaction, runtime.errors, deal.supplierOrganizationId, deal.customerOrganizationId);
      if (document.content === undefined) {
        throw runtime.errors.internal();
      }

      const contentSha256 = sha256(toBinary(DocumentContentSchema, document.content, { writeUnknownFields: false }));
      if (isIssuer) {
        assignDocumentNumber(runtime.errors, transaction, document);
      }
      else if (document.signatures[0]?.contentSha256 !== contentSha256) {
        throw runtime.errors.internal();
      }
      document.signatures.push(create(DocumentSignatureSchema, {
        contentSha256,
        level: SignatureLevel.INTERNAL,
        organizationId: caller.organizationId,
        side: isIssuer ? ProfileKind.SUPPLIER : ProfileKind.CUSTOMER,
        signedAt: timestampFromMs(transaction.worldTimeMs),
        signerDisplayName: caller.user.displayName,
        signerRoleName: dealActorRoleName(transaction, caller),
        signerUserId: caller.user.id,
      }));
      document.status = nextStatus;
      document.version++;
      transaction.put('documents', document);
      publishDocumentEffects(runtime, transaction, deal, document);
      return response(projectDocument(document, caller.organizationId));
    },
    idempotencyKey: request.idempotencyKey,
    method,
    request,
    scope: caller.organizationId,
  });
});

export const createDocumentService = (runtime: IModuleRuntime): ServiceImpl<typeof DocumentService> => ({
  getDocument: (request, context) => {
    const caller = runtime.guard.guardPermissionCall(runtime.read, DocumentService.method.getDocument, request, context.requestHeader);
    const deal = readVisibleDeal(runtime.read, runtime.errors, request.dealId, caller);
    const document = readDocument(runtime, runtime.read, deal, request.documentId);
    return create(GetDocumentResponseSchema, { document: projectDocument(document, caller.organizationId) });
  },
  listDealDocuments: (request, context) => {
    const caller = runtime.guard.guardPermissionCall(
      runtime.read, DocumentService.method.listDealDocuments, request, context.requestHeader,
    );
    const deal = readVisibleDeal(runtime.read, runtime.errors, request.dealId, caller);
    const documents = readDealDocuments(runtime.read, deal);
    const { items, page } = paginate(documents, document => document.id, request.page, runtime.errors);
    return create(ListDealDocumentsResponseSchema, {
      documents: items.map(document => projectDocument(document, caller.organizationId)),
      page,
    });
  },
  signDocument: (request, context) => signDocument(runtime, {
    headers: context.requestHeader,
    isContract: false,
    method: DocumentService.method.signDocument,
    request,
    response: document => create(SignDocumentResponseSchema, { document }),
  }),
  signSupplyContract: (request, context) => signDocument(runtime, {
    headers: context.requestHeader,
    isContract: true,
    method: DocumentService.method.signSupplyContract,
    request,
    response: document => create(SignSupplyContractResponseSchema, { document }),
  }),
});
