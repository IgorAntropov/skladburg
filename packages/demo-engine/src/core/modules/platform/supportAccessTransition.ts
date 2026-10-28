import type { SupportAccessChange } from '@skladburg/contracts/support/v1/support_events';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  type SupportAccessSession,
  SupportAccessStatus,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';
import { SupportAccessChangedSchema } from '@skladburg/contracts/support/v1/support_events';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  findSupportAccessTransition,
  isSupportAccessFinal,
  readIntendedSupportAccessStatus,
  SupportAccessCommand,
} from './supportAccessMachine';
import { MINUTE_MS } from './supportAccessRules';
import { appendSupportAuditEntry } from './supportAuditRecords';

export interface ISupportAccessTransitioner {
  apply: (transaction: IStateTransaction, input: SupportAccessTransitionInputValue) => SupportAccessSession;
  publish: (transaction: IStateTransaction, session: SupportAccessSession, change: SupportAccessChange) => void;
}

export interface SupportAccessTransitionInputValue {
  actorUserId: string;
  command: SupportAccessCommand;
  expectedVersion: number | undefined;
  session: SupportAccessSession;
}

export const createSupportAccessTransitioner = (
  runtime: Pick<IModuleRuntime, 'errors' | 'outbox' | 'random'>,
): ISupportAccessTransitioner => {
  const { errors, outbox, random } = runtime;

  const publish: ISupportAccessTransitioner['publish'] = (transaction, session, change) => {
    outbox.add(transaction, organizationChannel(session.organizationId), {
      case: 'supportAccessChanged',
      value: create(SupportAccessChangedSchema, { change, sessionId: session.id }),
    });
  };

  const apply: ISupportAccessTransitioner['apply'] = (transaction, input) => {
    const { actorUserId, command, expectedVersion, session } = input;

    if (expectedVersion !== undefined && expectedVersion !== session.version) {
      throw errors.versionConflict(EntityKind.SUPPORT_ACCESS_SESSION, session.version);
    }

    const transition = findSupportAccessTransition(command, session.status);

    if (transition === undefined) {
      throw errors.invalidTransition(
        EntityKind.SUPPORT_ACCESS_SESSION,
        SupportAccessStatus[session.status],
        SupportAccessStatus[readIntendedSupportAccessStatus(command)],
      );
    }

    session.status = transition.status;
    session.closeReason = transition.closeReason;
    session.version += 1;

    if (command === SupportAccessCommand.APPROVE) {
      session.startedAt = timestampFromMs(transaction.worldTimeMs);
      session.expiresAt = timestampFromMs(transaction.worldTimeMs + session.durationMinutes * MINUTE_MS);
      session.approvedByUserId = actorUserId;
    }

    if (isSupportAccessFinal(session.status)) {
      session.endedAt = timestampFromMs(transaction.worldTimeMs);
    }

    transaction.put('supportAccessSessions', session);
    appendSupportAuditEntry(transaction, random, {
      action: transition.action,
      actorUserId,
      closeReason: transition.closeReason,
      outcome: SupportAuditOutcome.ALLOWED,
      session,
    });
    publish(transaction, session, transition.change);

    return session;
  };

  return { apply, publish };
};
