import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';
import { RoleSchema } from '@skladburg/contracts/access/v1/access';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealService,
  DealStatus,
  SupplyContractSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentService,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import {
  captureFailure,
  nextUuid,
  SUPPLIER_1_CALL,
} from '../catalog/testing/catalogFixtures';
import { createDealFixture } from '../deals/testing/dealFixtures';
import { callAs } from '../testing/moduleHarness';

const setup = async (): Promise<{
  deals: ReturnType<typeof createClient<typeof DealService>>;
  documents: ReturnType<typeof createClient<typeof DocumentService>>;
  prepareDeal: () => Promise<string>;
  storage: Awaited<ReturnType<typeof createTestEngine>>['storage'];
}> => {
  const { harness, request } = await createDealFixture();
  const { engine, storage } = await createTestEngine({ storage: createSpyStorage(await harness.storage.load()) });
  const transport = createEngineTransport(engine, true);
  const deals = createClient(DealService, transport);
  const documents = createClient(DocumentService, transport);
  const prepareDeal = async (): Promise<string> => {
    const dealId = nextUuid();
    const created = await deals.createDealDraft({ ...request, dealId, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
    const submitted = await deals.submitDeal({
      dealId, expectedVersion: 1, goodsTotal: created.deal?.goodsTotal, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL);
    await deals.confirmDeal({
      dealId,
      expectedVersion: 2,
      goodsTotal: submitted.deal?.goodsTotal,
      idempotencyKey: nextUuid(),
      shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
    }, SUPPLIER_1_CALL);
    await deals.chooseDelivery({
      dealId, deliveryMethod: DeliveryMethod.CUSTOMER, expectedVersion: 3, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL);
    return dealId;
  };
  return { deals, documents, prepareDeal, storage };
};

describe('deal documents through Connect', () => {
  it('assigns numbers on the first signature, shares the contract, and advances only after all second signatures', async () => {
    const { deals, documents, prepareDeal } = await setup();
    const dealId = await prepareDeal();
    const first = await documents.listDealDocuments({ dealId }, SUPPLIER_1_CALL);
    expect(first.documents.map(doc => doc.type)).toEqual([DocumentType.SUPPLY_CONTRACT, DocumentType.SPECIFICATION, DocumentType.INVOICE]);
    const firstPage = await documents.listDealDocuments({ dealId, page: { pageSize: 1 } }, SUPPLIER_1_CALL);
    const nextPage = await documents.listDealDocuments({
      dealId, page: { pageSize: 2, pageToken: firstPage.page?.nextPageToken },
    }, SUPPLIER_1_CALL);
    expect([...firstPage.documents, ...nextPage.documents]).toEqual(first.documents);
    for (const draft of first.documents) {
      expect(draft).toMatchObject({ number: 0, status: DocumentStatus.DRAFT, version: 1 });
      expect(draft.content?.supplier?.legalName).toBeTruthy();
      expect(draft.content?.supplier?.bank?.settlementAccount).toBeTruthy();
      const sign = draft.type === DocumentType.SUPPLY_CONTRACT ? documents.signSupplyContract : documents.signDocument;
      const request = { dealId, documentId: draft.id, expectedVersion: 1, idempotencyKey: nextUuid() };
      expect((await captureFailure(sign(request, CUSTOMER_CALL))).code).toBe(ErrorCode.INVALID_TRANSITION);
      const signed = await sign(request, SUPPLIER_1_CALL);
      expect(signed.document).toMatchObject({ number: 1, status: DocumentStatus.APPROVED, version: 2 });
      expect(await sign(request, SUPPLIER_1_CALL)).toEqual(signed);
      expect(signed.document?.content).toEqual(draft.content);
      const accepted = await sign({ ...request, expectedVersion: 2, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
      expect(accepted.document).toMatchObject({ number: 1, status: DocumentStatus.SIGNED, version: 3 });
      const hashes = accepted.document?.signatures.map(signature => signature.contentSha256);
      expect(hashes?.[0]).toMatch(/^[a-f0-9]{64}$/u);
      expect(hashes?.[0]).toBe(hashes?.[1]);
      expect(accepted.document?.content).toEqual(draft.content);
      expect(accepted.document?.signatures[0]?.signerUserId).toBe('');
      expect(accepted.document?.signatures[0]?.signerRoleName).toBe('');
      expect(accepted.document?.signatures[0]?.signerDisplayName).toBeTruthy();
      expect(accepted.document?.signatures[1]?.signerRoleName).toBeTruthy();
      expect(accepted.document?.signatures[1]?.signerDisplayName).toBeTruthy();
      expect(accepted.document?.signatures[1]?.signerUserId).toBe(SeedUserId.ADMIN_1);
    }
    const { deal } = await deals.getDeal({ dealId }, CUSTOMER_CALL);
    expect(deal?.status).toBe(DealStatus.AWAITING_PAYMENT);
    expect(deal?.transitions.slice(-2).map(transition => transition.to)).toEqual([
      DealStatus.DOCUMENTS_CONFIRMED, DealStatus.AWAITING_PAYMENT,
    ]);

    const nextId = await prepareDeal();
    const next = await documents.listDealDocuments({ dealId: nextId }, CUSTOMER_CALL);
    expect(next.documents[0]).toEqual((await documents.listDealDocuments({ dealId }, CUSTOMER_CALL)).documents[0]);
    expect(next.documents.slice(1).every(doc => doc.status === DocumentStatus.DRAFT)).toBe(true);
  });

  it('finishes a second deal through the shared contract after the first deal is cancelled', async () => {
    const { deals, documents, prepareDeal } = await setup();
    const firstId = await prepareDeal();
    const secondId = await prepareDeal();
    const { documents: [contract] } = await documents.listDealDocuments({ dealId: firstId }, SUPPLIER_1_CALL);
    const request = { dealId: firstId, documentId: contract?.id ?? '', expectedVersion: 1, idempotencyKey: nextUuid() };
    await documents.signSupplyContract(request, SUPPLIER_1_CALL);
    await deals.cancelDeal({
      dealId: firstId, expectedVersion: 4, idempotencyKey: nextUuid(), reason: 'Отмена первой поставки',
    }, CUSTOMER_CALL);

    const second = await documents.listDealDocuments({ dealId: secondId }, SUPPLIER_1_CALL);
    expect(second.documents[0]).toMatchObject({ id: contract?.id, number: 1, status: DocumentStatus.APPROVED });
    for (const document of second.documents.slice(1)) {
      const sign = { dealId: secondId, documentId: document.id, expectedVersion: 1, idempotencyKey: nextUuid() };
      await documents.signDocument(sign, SUPPLIER_1_CALL);
      await documents.signDocument({ ...sign, expectedVersion: 2, idempotencyKey: nextUuid() }, CUSTOMER_CALL);
    }
    expect((await deals.getDeal({ dealId: secondId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.LOGISTICS_CHOSEN);

    await documents.signSupplyContract({
      ...request, dealId: secondId, expectedVersion: 2, idempotencyKey: nextUuid(),
    }, CUSTOMER_CALL);
    expect((await deals.getDeal({ dealId: firstId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.CANCELLED);
    expect((await deals.getDeal({ dealId: secondId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.AWAITING_PAYMENT);
  });

  it('restores missing document drafts on startup once for an existing logistics decision', async () => {
    const { prepareDeal, storage } = await setup();
    const dealId = await prepareDeal();
    const saved = await storage.load();
    if (saved === undefined) {
      throw new Error('Missing saved world');
    }
    const contracts = new Map(saved.collections.supplyContracts);
    for (const [id, bytes] of contracts) {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError('Expected a binary supply contract');
      }
      const contract = fromBinary(SupplyContractSchema, bytes);
      contracts.set(id, toBinary(SupplyContractSchema, { ...contract, documentId: '' }));
    }
    const upgraded = createSpyStorage({
      ...saved,
      collections: { ...saved.collections, documents: new Map(), supplyContracts: contracts },
    });
    const first = await createTestEngine({ storage: upgraded });
    const documents = createClient(DocumentService, createEngineTransport(first.engine, true));
    const drafts = await documents.listDealDocuments({ dealId }, CUSTOMER_CALL);
    expect(drafts.documents.map(document => document.status)).toEqual(Array(3).fill(DocumentStatus.DRAFT));
    expect(upgraded.commits).toHaveLength(1);
    const restarted = await createTestEngine({ storage: upgraded });
    const restored = createClient(DocumentService, createEngineTransport(restarted.engine, true));
    expect(await restored.listDealDocuments({ dealId }, CUSTOMER_CALL)).toEqual(drafts);
    expect(upgraded.commits).toHaveLength(1);
  });

  it('rejects unrelated organizations, missing signature rights and the wrong signing method', async () => {
    const { documents, prepareDeal } = await setup();
    const dealId = await prepareDeal();
    const outsider = callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2);
    expect((await captureFailure(documents.listDealDocuments({ dealId }, outsider))).code).toBe(ErrorCode.NOT_FOUND);
    const { documents: [contract] } = await documents.listDealDocuments({ dealId }, CUSTOMER_CALL);
    const request = { dealId, documentId: contract?.id ?? '', expectedVersion: 1, idempotencyKey: nextUuid() };
    const buyer = callAs(SeedUserId.BUYER_1, SeedOrganizationId.CUSTOMER_1);
    expect((await captureFailure(documents.signSupplyContract(request, buyer))).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect((await captureFailure(documents.signDocument(request, SUPPLIER_1_CALL))).code).toBe(ErrorCode.PERMISSION_DENIED);
    const results = await Promise.allSettled([
      documents.signSupplyContract(request, SUPPLIER_1_CALL),
      documents.signSupplyContract({ ...request, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((await documents.getDocument(request, SUPPLIER_1_CALL)).document).toMatchObject({
      number: 1, status: DocumentStatus.APPROVED, version: 2,
    });
  });

  it('requires document view to sign and to replay an earlier signature', async () => {
    const { documents, prepareDeal, storage } = await setup();
    const dealId = await prepareDeal();
    const { documents: [contract, specification] } = await documents.listDealDocuments({ dealId }, SUPPLIER_1_CALL);
    const request = { dealId, documentId: contract?.id ?? '', expectedVersion: 1, idempotencyKey: nextUuid() };
    await documents.signSupplyContract(request, SUPPLIER_1_CALL);

    const snapshot = await storage.load();
    const roleId = SeedRoleId.DIRECTOR_SUPPLIER_1;
    const bytes = snapshot?.collections.roles.get(roleId);
    if (snapshot === undefined || !(bytes instanceof Uint8Array)) {
      throw new Error('Missing issuer role');
    }
    const role = fromBinary(RoleSchema, bytes);
    role.permissions = role.permissions.filter(permission => permission !== 'document_view');
    const roles = new Map(snapshot.collections.roles);
    roles.set(roleId, toBinary(RoleSchema, role));
    const { engine } = await createTestEngine({
      storage: createSpyStorage({ ...snapshot, collections: { ...snapshot.collections, roles } }),
    });
    const restricted = createClient(DocumentService, createEngineTransport(engine, true));
    expect((await captureFailure(restricted.signSupplyContract(request, SUPPLIER_1_CALL))).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect((await captureFailure(restricted.signDocument({
      ...request, documentId: specification?.id ?? '', idempotencyKey: nextUuid(),
    }, SUPPLIER_1_CALL))).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('keeps the first number available after storage rejects a signature and retains it after annulment', async () => {
    const { deals, documents, prepareDeal, storage } = await setup();
    const dealId = await prepareDeal();
    const first = await documents.listDealDocuments({ dealId }, CUSTOMER_CALL);
    const invoice = first.documents.find(doc => doc.type === DocumentType.INVOICE);
    if (invoice === undefined) {
      throw new Error('Missing invoice draft');
    }
    const request = { dealId, documentId: invoice.id, expectedVersion: invoice.version, idempotencyKey: nextUuid() };
    storage.failNextCommit();
    expect((await captureFailure(documents.signDocument(request, SUPPLIER_1_CALL))).code).toBe(ErrorCode.UNAVAILABLE);
    expect((await documents.getDocument({ dealId, documentId: invoice.id }, CUSTOMER_CALL)).document).toEqual(invoice);
    const signed = await documents.signDocument(request, SUPPLIER_1_CALL);
    expect(signed.document?.number).toBe(1);
    await deals.cancelDeal({ dealId, expectedVersion: 4, idempotencyKey: nextUuid(), reason: 'Отмена заказа' }, CUSTOMER_CALL);
    const cancelled = await documents.getDocument({ dealId, documentId: invoice.id }, SUPPLIER_1_CALL);
    expect(cancelled.document).toMatchObject({
      content: signed.document?.content,
      number: 1,
      signatures: signed.document?.signatures,
      status: DocumentStatus.ANNULLED,
    });
    const nextId = await prepareDeal();
    const next = await documents.listDealDocuments({ dealId: nextId }, CUSTOMER_CALL);
    const nextInvoice = next.documents.find(doc => doc.type === DocumentType.INVOICE);
    expect((await documents.signDocument({
      dealId: nextId, documentId: nextInvoice?.id ?? '', expectedVersion: 1, idempotencyKey: nextUuid(),
    }, SUPPLIER_1_CALL)).document?.number).toBe(2);
  });
});
