import type { HandlerContext } from '@connectrpc/connect';
import type {
  ConfirmDealReceiptRequest,
  ConfirmDealReceiptResponse,
  Deal,
  GetDealReceiptRequest,
  GetDealReceiptResponse,
  OpenDealReceiptClaimRequest,
  OpenDealReceiptClaimResponse,
} from '@skladburg/contracts/deal/v1/deal';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ConfirmDealReceiptResponseSchema,
  DealSchema,
  DealService,
  DealStatus,
  GetDealReceiptResponseSchema,
  OpenDealReceiptClaimResponseSchema,
} from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';
import { DocumentType } from '@skladburg/contracts/document/v1/document';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';

import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  issueReceiptClaim,
  issueReceiptDiscrepancyAct,
  readReceiptDocument,
  signReceiptTitle,
} from '../documents/receiptDocuments';
import { publishTripChanges } from '../logistics/transportEvents';
import { readTripForDeal } from '../logistics/tripLifecycle';
import { loadPayments } from '../payments/loadPayments';
import {
  readInboundTask,
  saveInboundTask,
} from '../wms/inboundRecords';
import {
  classifyWarehouseReceipt,
  reconcileWarehouseReceipt,
} from '../wms/receiptReconciliation';
import { readVisibleDeal } from './dealAccess';
import { runDealCommand } from './dealCommand';
import {
  advanceSystemDeal,
  publishDealEffects,
} from './dealEffects';

const readReceiptTask = (reader: IStateReader, runtime: IModuleRuntime, deal: Deal): ReceivingTask | undefined => {
  const record = reader.get('warehouseInbound', deal.id);
  if (record === undefined) {
    return undefined;
  }
  if (record.lookupKey !== deal.customerOrganizationId || record.scopeId !== deal.shipToWarehouseId) {
    throw runtime.errors.internal();
  }
  const task = readInboundTask(record, runtime.errors);
  return task.finishedAt === undefined ? undefined : task;
};

const requireReceiptTask = (transaction: IStateTransaction, runtime: IModuleRuntime, deal: Deal): ReceivingTask => {
  const task = readReceiptTask(transaction, runtime, deal);
  if (task?.status !== ReceivingTaskStatus.READY_FOR_RECONCILIATION || task.updDocumentId === undefined) {
    throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], 'CONFIRM_RECEIPT');
  }
  return task;
};

const publishReceiptDocuments = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  publishDealEffects(runtime, transaction, deal, undefined, DealChange.DOCUMENTS, '');
};

export const finishInboundReceipt = (transaction: IStateTransaction, runtime: IModuleRuntime, task: ReceivingTask): void => {
  const deal = transaction.get('deals', task.dealId);
  if (deal === undefined || task.updDocumentId === undefined) {
    throw runtime.errors.internal();
  }
  const result = reconcileWarehouseReceipt(runtime, task, deal);
  if (result.hasDiscrepancies) {
    issueReceiptDiscrepancyAct(transaction, runtime, deal, task, result.lines);
    publishReceiptDocuments(runtime, transaction, deal);
    const trip = readTripForDeal(transaction, deal.id);
    if (trip !== undefined) {
      publishTripChanges(runtime, transaction, trip);
    }
  }
  advanceSystemDeal(runtime, transaction, deal, 'startAccepting');
};

export const getDealReceipt = (
  runtime: IModuleRuntime,
  request: GetDealReceiptRequest,
  context: HandlerContext,
): GetDealReceiptResponse => {
  const { errors, guard, read } = runtime;
  const caller = guard.guardPermissionCall(read, DealService.method.getDealReceipt, request, context.requestHeader);
  const deal = readVisibleDeal(read, errors, request.dealId, caller);
  const task = readReceiptTask(read, runtime, deal);
  if (task?.updDocumentId === undefined) {
    return create(GetDealReceiptResponseSchema);
  }

  const { hasDiscrepancies, lines } = reconcileWarehouseReceipt(runtime, task, deal);
  return create(GetDealReceiptResponseSchema, {
    receipt: {
      claimDocumentId: readReceiptDocument(read, deal.id, DocumentType.RECEIPT_CLAIM)?.id,
      dealId: deal.id,
      discrepancyActDocumentId: readReceiptDocument(read, deal.id, DocumentType.RECEIPT_DISCREPANCY_ACT)?.id,
      hasDiscrepancies,
      lines,
      receiptTitleDocumentId: readReceiptDocument(read, deal.id, DocumentType.RECEIPT_TITLE)?.id,
      updDocumentId: task.updDocumentId,
    },
  });
};

export const openDealReceiptClaim = (
  runtime: IModuleRuntime,
  request: OpenDealReceiptClaimRequest,
  context: HandlerContext,
): Promise<OpenDealReceiptClaimResponse> => runDealCommand(runtime, {
  command: 'openClaim',
  handle: (transaction, _caller, deal) => {
    const task = requireReceiptTask(transaction, runtime, deal);
    const act = readReceiptDocument(transaction, deal.id, DocumentType.RECEIPT_DISCREPANCY_ACT);
    if (act === undefined) {
      throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[DealStatus.CLAIM]);
    }
    issueReceiptClaim(transaction, runtime, deal, act, reconcileWarehouseReceipt(runtime, task, deal).acceptedGoodsMinor);
    publishReceiptDocuments(runtime, transaction, deal);
    return clone(DealSchema, deal);
  },
  headers: context.requestHeader,
  method: DealService.method.openDealReceiptClaim,
  notice: undefined,
  request,
  response: deal => create(OpenDealReceiptClaimResponseSchema, { deal }),
});

export const confirmDealReceipt = async (
  runtime: IModuleRuntime,
  request: ConfirmDealReceiptRequest,
  context: HandlerContext,
): Promise<ConfirmDealReceiptResponse> => {
  const [{ scheduleAcceptedPayout }, { schedulePartialReceiptPayout }] = await Promise.all([
    loadPayments(),
    import('../payments/partialReceiptSettlement'),
  ]);
  return runDealCommand(runtime, {
    authorize: (caller) => {
      if (caller.admission.kind !== 'membership'
        || !caller.permissions.some(permission => permission.permission === 'document_view' && permission.isOrganizationWide)) {
        throw runtime.errors.permissionDenied('document_view');
      }
    },
    command: 'confirmReceipt',
    handle: (transaction, caller, deal) => {
      const task = requireReceiptTask(transaction, runtime, deal);
      const result = reconcileWarehouseReceipt(runtime, task, deal);
      if (result.hasDiscrepancies !== (deal.status === DealStatus.CLAIM)
        || (result.hasDiscrepancies && readReceiptDocument(transaction, deal.id, DocumentType.RECEIPT_CLAIM) === undefined)) {
        throw runtime.errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], 'CONFIRM_RECEIPT');
      }
      if (task.version >= 2_147_483_647) {
        throw runtime.errors.unavailable();
      }

      const title = signReceiptTitle(transaction, runtime, deal, task, result.lines, caller);
      classifyWarehouseReceipt(runtime, transaction, caller, task, result, title.displayNumber);
      task.status = ReceivingTaskStatus.RECONCILED;
      task.version++;
      saveInboundTask(transaction, runtime, task, deal.customerOrganizationId);
      if (result.hasDiscrepancies) {
        schedulePartialReceiptPayout(runtime, transaction, deal, result.acceptedGoodsMinor);
      }
      else {
        scheduleAcceptedPayout(runtime, transaction, deal);
      }
      publishReceiptDocuments(runtime, transaction, deal);
      return clone(DealSchema, deal);
    },
    headers: context.requestHeader,
    method: DealService.method.confirmDealReceipt,
    notice: undefined,
    request,
    response: deal => create(ConfirmDealReceiptResponseSchema, { deal }),
  });
};
