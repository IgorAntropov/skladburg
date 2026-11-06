import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { Document } from '@skladburg/contracts/document/v1/document';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  DealSchema,
  DealStatus,
  DealTransitionSchema,
} from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { createDealDeadlines } from '../deals/dealDeadlines';
import { publishDealEffects } from '../deals/dealEffects';
import { dealMachine } from '../deals/dealMachine';
import { readDealDocuments } from './dealDocuments';

const advanceDeal = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): boolean => {
  if (deal.status !== DealStatus.LOGISTICS_CHOSEN) {
    return false;
  }
  const documents = readDealDocuments(transaction, deal);
  if (documents.length !== 3 || documents.some(document => document.status !== DocumentStatus.SIGNED)) {
    return false;
  }

  const next = clone(DealSchema, deal);
  const at = timestampFromMs(transaction.worldTimeMs);
  for (const command of ['confirmDocuments', 'requestPayment'] as const) {
    const { status } = dealMachine.requireTransition(runtime.errors, command, next, next.version);
    if (next.version >= 2_147_483_647) {
      throw runtime.errors.unavailable();
    }
    next.transitions.push(create(DealTransitionSchema, { at, from: next.status, to: status }));
    next.status = status;
    next.version++;
  }
  next.deadlines = createDealDeadlines(runtime, transaction, next, 'payment');
  next.updatedAt = at;
  transaction.put('deals', next);
  return true;
};

export const publishDocumentEffects = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  document: Document,
): void => {
  const related = document.type === DocumentType.SUPPLY_CONTRACT
    ? transaction.listBy('deals', 'customerOrganizationId', deal.customerOrganizationId)
        .filter(candidate => candidate.contractId === deal.contractId && candidate.submittedAt !== undefined)
    : [deal];

  for (const current of related) {
    if (advanceDeal(runtime, transaction, current)) {
      publishDealEffects(runtime, transaction, current, undefined, DealChange.STATUS, '');
    }
    publishDealEffects(runtime, transaction, current, undefined, DealChange.DOCUMENTS, '');
  }
};
