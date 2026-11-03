import type {
  BlockedHandlerValue,
  ShouldBlockValue,
} from './locationTypes';

export interface BlockerValue {
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
