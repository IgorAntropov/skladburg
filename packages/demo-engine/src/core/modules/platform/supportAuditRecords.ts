import type { ErrorCode } from '@skladburg/contracts/common/v1/error';
import type {
  SupportAccessCloseReason,
  SupportAccessSession,
  SupportAuditAction,
  SupportAuditEntry,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { SupportAuditEntrySchema } from '@skladburg/contracts/support/v1/support_access';

import type { IRandom } from '../../ports/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';

import {
  compareNewestFirst,
  createSequencedId,
} from './supportAccessRecords';

export interface SupportAuditEntryInputValue {
  action: SupportAuditAction;
  actorUserId: string;
  closeReason?: SupportAccessCloseReason | undefined;
  errorCode?: ErrorCode | undefined;
  method?: string | undefined;
  outcome: SupportAuditOutcome;
  permission?: string | undefined;
  session: SupportAccessSession;
}

export const appendSupportAuditEntry = (
  transaction: IStateTransaction,
  random: IRandom,
  input: SupportAuditEntryInputValue,
): SupportAuditEntry => {
  const { session } = input;
  const entry = create(SupportAuditEntrySchema, {
    action: input.action,
    actorUserId: input.actorUserId,
    closeReason: input.closeReason,
    errorCode: input.errorCode,
    id: createSequencedId(random, transaction.listBy('supportAuditEntries', 'organizationId', session.organizationId).length),
    method: input.method ?? '',
    occurredAt: timestampFromMs(transaction.worldTimeMs),
    organizationId: session.organizationId,
    outcome: input.outcome,
    permission: input.permission ?? '',
    sessionId: session.id,
    staffDisplayName: session.staffDisplayName,
    staffUserId: session.staffUserId,
    ticketNumber: session.ticketNumber,
  });

  if (transaction.get('supportAuditEntries', entry.id) !== undefined) {
    throw new Error(`The support audit entry ${entry.id} is already written`);
  }

  transaction.put('supportAuditEntries', entry);

  return entry;
};

export const listSupportAuditEntries = (
  reader: IStateReader,
  organizationId: string,
  sessionId: string,
): SupportAuditEntry[] =>
  reader.listBy('supportAuditEntries', 'organizationId', organizationId)
    .filter(entry => sessionId === '' || entry.sessionId === sessionId)
    .sort((current, prev) => compareNewestFirst(
      { id: current.id, time: current.occurredAt },
      { id: prev.id, time: prev.occurredAt },
    ));
