import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { SupportAccessStatus } from '@skladburg/contracts/support/v1/support_access';

import type { SchedulerTaskValue } from '../../scheduler/scheduler';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { compareIds } from '../../state/index';
import { SupportAccessCommand } from './supportAccessMachine';
import { readTimestampMs } from './supportAccessRecords';
import {
  SUPPORT_ACCESS_EXPIRY_INTERVAL_MS,
  SUPPORT_ACCESS_REQUEST_TTL_MS,
} from './supportAccessRules';
import { createSupportAccessTransitioner } from './supportAccessTransition';

export const SUPPORT_ACCESS_EXPIRY_TASK_ID = 'support-access-expiry';

const isExpired = (session: SupportAccessSession, nowMs: number): boolean => {
  if (session.status === SupportAccessStatus.ACTIVE) {
    return readTimestampMs(session.expiresAt) <= nowMs;
  }

  return session.status === SupportAccessStatus.REQUESTED
    && readTimestampMs(session.requestedAt) + SUPPORT_ACCESS_REQUEST_TTL_MS <= nowMs;
};

export const createSupportAccessExpiryTask = (runtime: IModuleRuntime): SchedulerTaskValue => {
  const transitioner = createSupportAccessTransitioner(runtime);

  return {
    id: SUPPORT_ACCESS_EXPIRY_TASK_ID,
    intervalMs: SUPPORT_ACCESS_EXPIRY_INTERVAL_MS,
    run: (transaction: IStateTransaction) => {
      const expired = transaction.list('supportAccessSessions')
        .filter(session => isExpired(session, transaction.worldTimeMs))
        .sort((current, prev) => compareIds(current.id, prev.id));

      for (const session of expired) {
        transitioner.apply(transaction, {
          actorUserId: '',
          command: SupportAccessCommand.EXPIRE,
          expectedVersion: undefined,
          session,
        });
      }
    },
  };
};
