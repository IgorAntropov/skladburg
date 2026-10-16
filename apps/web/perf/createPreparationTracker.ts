export interface IPreparationTracker {
  begin: (id: string) => boolean;
  outcomes: () => PreparationOutcomeValue[];
  settle: (id: string, outcome: Exclude<PreparationOutcomeValue, 'pending'>) => void;
  waitForSettled: (timeoutMs: number) => Promise<void>;
}

export type PreparationOutcomeValue = 'applied' | 'pending' | 'refused';

export const createPreparationTracker = (): IPreparationTracker => {
  const outcomeById = new Map<string, PreparationOutcomeValue>();
  const waiters = new Set<() => void>();

  const isAllSettled = (): boolean => [...outcomeById.values()].every(outcome => outcome !== 'pending');

  return {
    begin(id: string): boolean {
      if (outcomeById.has(id)) {
        return false;
      }

      outcomeById.set(id, 'pending');

      return true;
    },
    outcomes(): PreparationOutcomeValue[] {
      return [...outcomeById.values()];
    },
    settle(id: string, outcome: Exclude<PreparationOutcomeValue, 'pending'>): void {
      if (outcomeById.get(id) !== 'pending') {
        return;
      }

      outcomeById.set(id, outcome);

      if (isAllSettled()) {
        for (const wake of [...waiters]) {
          wake();
        }
      }
    },
    waitForSettled(timeoutMs: number): Promise<void> {
      if (isAllSettled()) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const finish = (): void => {
          clearTimeout(timer);
          waiters.delete(finish);
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);

        waiters.add(finish);
      });
    },
  };
};
