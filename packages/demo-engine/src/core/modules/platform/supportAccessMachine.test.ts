import {
  SupportAccessCloseReason,
  SupportAccessStatus,
  SupportAuditAction,
} from '@skladburg/contracts/support/v1/support_access';
import { SupportAccessChange } from '@skladburg/contracts/support/v1/support_events';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  findSupportAccessTransition,
  isSupportAccessFinal,
  readIntendedSupportAccessStatus,
  SupportAccessCommand,
} from './supportAccessMachine';

const STATUSES: readonly SupportAccessStatus[] = [
  SupportAccessStatus.REQUESTED,
  SupportAccessStatus.ACTIVE,
  SupportAccessStatus.DECLINED,
  SupportAccessStatus.CANCELLED,
  SupportAccessStatus.CLOSED,
];

interface ExpectedTransitionValue {
  action: SupportAuditAction;
  change: SupportAccessChange;
  closeReason: SupportAccessCloseReason;
  status: SupportAccessStatus;
}

const EXPECTED: Readonly<Record<SupportAccessCommand, Readonly<Partial<Record<SupportAccessStatus, ExpectedTransitionValue>>>>> = {
  [SupportAccessCommand.APPROVE]: {
    [SupportAccessStatus.REQUESTED]: {
      action: SupportAuditAction.SESSION_APPROVED,
      change: SupportAccessChange.STARTED,
      closeReason: SupportAccessCloseReason.UNSPECIFIED,
      status: SupportAccessStatus.ACTIVE,
    },
  },
  [SupportAccessCommand.CLOSE_BY_SUPER_ADMIN]: {
    [SupportAccessStatus.ACTIVE]: {
      action: SupportAuditAction.SESSION_CLOSED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPER_ADMIN,
      status: SupportAccessStatus.CLOSED,
    },
    [SupportAccessStatus.REQUESTED]: {
      action: SupportAuditAction.SESSION_CANCELLED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPER_ADMIN,
      status: SupportAccessStatus.CANCELLED,
    },
  },
  [SupportAccessCommand.CLOSE_BY_SUPPORT]: {
    [SupportAccessStatus.ACTIVE]: {
      action: SupportAuditAction.SESSION_CLOSED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPPORT,
      status: SupportAccessStatus.CLOSED,
    },
    [SupportAccessStatus.REQUESTED]: {
      action: SupportAuditAction.SESSION_CANCELLED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPPORT,
      status: SupportAccessStatus.CANCELLED,
    },
  },
  [SupportAccessCommand.DECLINE]: {
    [SupportAccessStatus.REQUESTED]: {
      action: SupportAuditAction.SESSION_DECLINED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.UNSPECIFIED,
      status: SupportAccessStatus.DECLINED,
    },
  },
  [SupportAccessCommand.END]: {
    [SupportAccessStatus.ACTIVE]: {
      action: SupportAuditAction.SESSION_CLOSED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.ENDED_BY_CLIENT,
      status: SupportAccessStatus.CLOSED,
    },
  },
  [SupportAccessCommand.EXPIRE]: {
    [SupportAccessStatus.ACTIVE]: {
      action: SupportAuditAction.SESSION_CLOSED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.EXPIRED,
      status: SupportAccessStatus.CLOSED,
    },
    [SupportAccessStatus.REQUESTED]: {
      action: SupportAuditAction.SESSION_CANCELLED,
      change: SupportAccessChange.ENDED,
      closeReason: SupportAccessCloseReason.EXPIRED,
      status: SupportAccessStatus.CANCELLED,
    },
  },
};

const CELLS = (Object.values(SupportAccessCommand) as SupportAccessCommand[]).flatMap(command =>
  STATUSES.map(status => ({ command, expected: EXPECTED[command][status], status })));

describe('support access machine', () => {
  it('covers six commands against five statuses', () => {
    expect(Object.values(SupportAccessCommand)).toHaveLength(6);
    expect(CELLS).toHaveLength(30);
    expect(CELLS.filter(cell => cell.expected !== undefined)).toHaveLength(9);
  });

  it.each(CELLS)('$command from status $status leads to $expected', ({ command, expected, status }) => {
    expect(findSupportAccessTransition(command, status)).toEqual(expected);
  });

  it('never leaves a final status', () => {
    for (const command of Object.values(SupportAccessCommand)) {
      for (const status of STATUSES.filter(isSupportAccessFinal)) {
        expect(findSupportAccessTransition(command, status)).toBeUndefined();
      }
    }
  });

  it('knows no transition from the unspecified status', () => {
    for (const command of Object.values(SupportAccessCommand)) {
      expect(findSupportAccessTransition(command, SupportAccessStatus.UNSPECIFIED)).toBeUndefined();
    }
  });

  it('marks the declined, cancelled and closed statuses as final', () => {
    expect(STATUSES.filter(isSupportAccessFinal)).toEqual([
      SupportAccessStatus.DECLINED,
      SupportAccessStatus.CANCELLED,
      SupportAccessStatus.CLOSED,
    ]);
  });

  it('names the status a refused command was heading to', () => {
    expect(readIntendedSupportAccessStatus(SupportAccessCommand.APPROVE)).toBe(SupportAccessStatus.ACTIVE);
    expect(readIntendedSupportAccessStatus(SupportAccessCommand.DECLINE)).toBe(SupportAccessStatus.DECLINED);
    expect(readIntendedSupportAccessStatus(SupportAccessCommand.END)).toBe(SupportAccessStatus.CLOSED);
    expect(readIntendedSupportAccessStatus(SupportAccessCommand.EXPIRE)).toBe(SupportAccessStatus.CLOSED);
  });
});
