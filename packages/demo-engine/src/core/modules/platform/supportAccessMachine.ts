import {
  SupportAccessCloseReason,
  SupportAccessStatus,
  SupportAuditAction,
} from '@skladburg/contracts/support/v1/support_access';
import { SupportAccessChange } from '@skladburg/contracts/support/v1/support_events';

export const SupportAccessCommand = {
  APPROVE: 'approve',
  CLOSE_BY_SUPER_ADMIN: 'close_by_super_admin',
  CLOSE_BY_SUPPORT: 'close_by_support',
  DECLINE: 'decline',
  END: 'end',
  EXPIRE: 'expire',
} as const;

export type SupportAccessCommand = (typeof SupportAccessCommand)[keyof typeof SupportAccessCommand];

export interface SupportAccessTransitionValue {
  action: SupportAuditAction;
  change: SupportAccessChange;
  closeReason: SupportAccessCloseReason;
  status: SupportAccessStatus;
}

type TransitionRowValue = Readonly<Partial<Record<SupportAccessStatus, SupportAccessTransitionValue>>>;

const cancelled = (closeReason: SupportAccessCloseReason): SupportAccessTransitionValue => ({
  action: SupportAuditAction.SESSION_CANCELLED,
  change: SupportAccessChange.ENDED,
  closeReason,
  status: SupportAccessStatus.CANCELLED,
});

const closed = (closeReason: SupportAccessCloseReason): SupportAccessTransitionValue => ({
  action: SupportAuditAction.SESSION_CLOSED,
  change: SupportAccessChange.ENDED,
  closeReason,
  status: SupportAccessStatus.CLOSED,
});

const TRANSITIONS: Readonly<Record<SupportAccessCommand, TransitionRowValue>> = {
  [SupportAccessCommand.APPROVE]: {
    [SupportAccessStatus.REQUESTED]: {
      action: SupportAuditAction.SESSION_APPROVED,
      change: SupportAccessChange.STARTED,
      closeReason: SupportAccessCloseReason.UNSPECIFIED,
      status: SupportAccessStatus.ACTIVE,
    },
  },
  [SupportAccessCommand.CLOSE_BY_SUPER_ADMIN]: {
    [SupportAccessStatus.ACTIVE]: closed(SupportAccessCloseReason.CLOSED_BY_SUPER_ADMIN),
    [SupportAccessStatus.REQUESTED]: cancelled(SupportAccessCloseReason.CLOSED_BY_SUPER_ADMIN),
  },
  [SupportAccessCommand.CLOSE_BY_SUPPORT]: {
    [SupportAccessStatus.ACTIVE]: closed(SupportAccessCloseReason.CLOSED_BY_SUPPORT),
    [SupportAccessStatus.REQUESTED]: cancelled(SupportAccessCloseReason.CLOSED_BY_SUPPORT),
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
    [SupportAccessStatus.ACTIVE]: closed(SupportAccessCloseReason.ENDED_BY_CLIENT),
  },
  [SupportAccessCommand.EXPIRE]: {
    [SupportAccessStatus.ACTIVE]: closed(SupportAccessCloseReason.EXPIRED),
    [SupportAccessStatus.REQUESTED]: cancelled(SupportAccessCloseReason.EXPIRED),
  },
};

const INTENDED_STATUSES: Readonly<Record<SupportAccessCommand, SupportAccessStatus>> = {
  [SupportAccessCommand.APPROVE]: SupportAccessStatus.ACTIVE,
  [SupportAccessCommand.CLOSE_BY_SUPER_ADMIN]: SupportAccessStatus.CLOSED,
  [SupportAccessCommand.CLOSE_BY_SUPPORT]: SupportAccessStatus.CLOSED,
  [SupportAccessCommand.DECLINE]: SupportAccessStatus.DECLINED,
  [SupportAccessCommand.END]: SupportAccessStatus.CLOSED,
  [SupportAccessCommand.EXPIRE]: SupportAccessStatus.CLOSED,
};

const FINAL_STATUSES: ReadonlySet<SupportAccessStatus> = new Set([
  SupportAccessStatus.CANCELLED,
  SupportAccessStatus.CLOSED,
  SupportAccessStatus.DECLINED,
]);

export const findSupportAccessTransition = (
  command: SupportAccessCommand,
  status: SupportAccessStatus,
): SupportAccessTransitionValue | undefined => TRANSITIONS[command][status];

export const readIntendedSupportAccessStatus = (command: SupportAccessCommand): SupportAccessStatus => INTENDED_STATUSES[command];

export const isSupportAccessFinal = (status: SupportAccessStatus): boolean => FINAL_STATUSES.has(status);
