import type { IStateTransaction } from '../state/index';

export interface CreateSchedulerOptionsValue {
  command: <TResult>(work: (transaction: IStateTransaction) => TResult) => Promise<TResult>;
  getWorldTimeMs: () => number;
  initialDueAtMs?: Readonly<Record<string, number>>;
  maxRunsPerTick?: number;
}

export interface IScheduler {
  readDueAtMs: () => Record<string, number>;
  register: (task: SchedulerTaskValue) => void;
  restart: () => void;
  tick: () => Promise<void>;
}

export interface SchedulerTaskValue {
  id: string;
  intervalMs: number;
  run: (transaction: IStateTransaction, dueAtMs: number) => void;
}

interface ScheduledEntryValue {
  dueAtMs: number;
  order: number;
  task: SchedulerTaskValue;
}

export const DEFAULT_MAX_RUNS_PER_TICK = 100;

const compareEntries = (current: ScheduledEntryValue, next: ScheduledEntryValue): number =>
  current.dueAtMs - next.dueAtMs || current.order - next.order;

const findNextDue = (entries: readonly ScheduledEntryValue[], nowMs: number): ScheduledEntryValue | undefined =>
  entries.filter(entry => entry.dueAtMs <= nowMs).sort(compareEntries)[0];

export const createScheduler = (options: CreateSchedulerOptionsValue): IScheduler => {
  const maxRunsPerTick = options.maxRunsPerTick ?? DEFAULT_MAX_RUNS_PER_TICK;
  const entries: ScheduledEntryValue[] = [];

  const register = (task: SchedulerTaskValue): void => {
    if (!Number.isInteger(task.intervalMs) || task.intervalMs < 1) {
      throw new RangeError(`Task interval must be a positive integer number of milliseconds, got ${String(task.intervalMs)}`);
    }

    if (entries.some(entry => entry.task.id === task.id)) {
      throw new Error(`Task ${task.id} is already registered`);
    }

    const restoredDueAtMs = options.initialDueAtMs?.[task.id];

    entries.push({
      dueAtMs: restoredDueAtMs ?? options.getWorldTimeMs() + task.intervalMs,
      order: entries.length,
      task,
    });
  };

  const restart = (): void => {
    const nowMs = options.getWorldTimeMs();

    for (const entry of entries) {
      entry.dueAtMs = nowMs + entry.task.intervalMs;
    }
  };

  const readDueAtMs = (): Record<string, number> =>
    Object.fromEntries(entries.map(entry => [entry.task.id, entry.dueAtMs]));

  const runEntry = async (entry: ScheduledEntryValue): Promise<void> => {
    const { dueAtMs, task } = entry;
    entry.dueAtMs += task.intervalMs;

    try {
      await options.command((transaction) => {
        task.run(transaction, dueAtMs);
      });
    }
    catch (error) {
      console.log('> Scheduler -> runEntry:', { error, taskId: task.id });
    }
  };

  const tick = async (): Promise<void> => {
    const nowMs = options.getWorldTimeMs();

    for (let runs = 0; runs < maxRunsPerTick; runs += 1) {
      const entry = findNextDue(entries, nowMs);

      if (entry === undefined) {
        return;
      }

      await runEntry(entry);
    }
  };

  return { readDueAtMs, register, restart, tick };
};
