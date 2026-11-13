import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  DealStatus,
  DealTransitionSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';

import type { EngineSnapshotValue } from '../ports/index';

import { createDomainErrors } from '../errors/index';
import {
  issueInboundDocuments,
  issueReceiptDiscrepancyAct,
} from '../modules/documents/receiptDocuments';
import { readInboundTask } from '../modules/wms/inboundRecords';
import { reconcileWarehouseReceipt } from '../modules/wms/receiptReconciliation';
import { createRandom } from '../ports/index';
import {
  compareIds,
  createEngineState,
} from '../state/index';

export const migrateReceiptDocuments = (stored: EngineSnapshotValue): EngineSnapshotValue => {
  const state = createEngineState(stored);
  const random = createRandom(stored.meta.randomState);
  const errors = createDomainErrors(createRandom(stored.meta.traceRandomState));
  const { worldTimeMs, ...meta } = stored.meta;
  const readLiveMeta = (): typeof meta => ({ ...meta, randomState: random.getState() });
  const outcome = state.transact(worldTimeMs, (transaction) => {
    const pending = transaction.list('warehouseInbound').flatMap((record) => {
      const task = readInboundTask(record, errors);
      if (task.updDocumentId !== undefined) {
        return [];
      }
      const deal = transaction.get('deals', task.dealId);
      if (record.lookupKey !== deal?.customerOrganizationId || record.scopeId !== deal.shipToWarehouseId) {
        throw errors.internal();
      }
      const shippedAt = deal.transitions.find(transition => transition.to === DealStatus.SHIPPED)?.at;
      return [{ deal, record, shippedAtMs: shippedAt === undefined ? worldTimeMs : timestampMs(shippedAt), task }];
    });
    pending.sort((current, next) => current.shippedAtMs - next.shippedAtMs || compareIds(current.record.id, next.record.id));

    for (const { deal, record, shippedAtMs, task } of pending) {
      const dealLines = new Map(deal.lines.map(line => [line.id, line]));
      for (const line of task.orderLines) {
        const markingMode = dealLines.get(line.dealLineId)?.productSnapshot?.markingMode;
        if (markingMode !== undefined) {
          line.markingMode = markingMode;
        }
      }
      issueInboundDocuments(transaction, { errors, random }, deal, task, shippedAtMs);
      transaction.put('warehouseInbound', { ...record, bytes: toBinary(ReceivingTaskSchema, task) });
    }

    const completed = pending.flatMap(({ deal, task }) => {
      const { finishedAt, status } = task;
      return status === ReceivingTaskStatus.READY_FOR_RECONCILIATION && finishedAt !== undefined
        ? [{ deal, finishedAt, finishedAtMs: timestampMs(finishedAt), task }]
        : [];
    });
    completed.sort((current, next) => current.finishedAtMs - next.finishedAtMs || compareIds(current.task.id, next.task.id));
    for (const { deal, finishedAt, finishedAtMs, task } of completed) {
      const result = reconcileWarehouseReceipt({ errors }, task, deal);
      if (result.hasDiscrepancies) {
        issueReceiptDiscrepancyAct(transaction, { errors, random }, deal, task, result.lines, finishedAtMs);
      }
      if (deal.status === DealStatus.ARRIVED) {
        if (deal.version >= 2_147_483_647) {
          throw errors.unavailable();
        }
        deal.transitions.push(create(DealTransitionSchema, {
          at: finishedAt,
          from: deal.status,
          to: DealStatus.ACCEPTING,
        }));
        deal.status = DealStatus.ACCEPTING;
        deal.updatedAt = finishedAt;
        deal.version++;
        transaction.put('deals', deal);
      }
    }
  }, readLiveMeta);
  outcome.apply();
  return state.toSnapshot({ ...readLiveMeta(), worldTimeMs });
};
