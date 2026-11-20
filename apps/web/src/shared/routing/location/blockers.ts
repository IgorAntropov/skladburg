import type {
  BlockedHandlerValue,
  LeaveScopeValue,
  ShouldBlockValue,
} from './locationTypes';

export interface BlockerValue {
  isContextChangeGuarded: boolean;
  onBlocked: BlockedHandlerValue;
  shouldBlock: ShouldBlockValue | undefined;
}

export const findTriggered = (blockers: readonly BlockerValue[], nextPath: string): BlockerValue[] => {
  return blockers.filter(({ shouldBlock }) => shouldBlock === undefined || shouldBlock(nextPath));
};

export const askLastTriggered = (triggered: readonly BlockerValue[], proceed: () => void): void => {
  const asker = triggered.at(-1);

  for (const blocker of triggered) {
    blocker.onBlocked(blocker === asker ? proceed : undefined);
  }
};

export const requestGuardedLeave = (blockers: readonly BlockerValue[], action: () => void, scope: LeaveScopeValue = 'context'): void => {
  const triggered = scope === 'all' ? blockers : blockers.filter(({ isContextChangeGuarded }) => isContextChangeGuarded);
  if (triggered.length === 0) {
    action();

    return;
  }

  askLastTriggered(triggered, action);
};
