export const LONG_TASK_THRESHOLD_MS = 50;

export interface LongTaskSummaryValue {
  count: number;
  excessMs: number;
}

export interface LongTaskValue {
  durationMs: number;
  startAt: number;
}

export const summarizeLongTasks = (tasks: readonly LongTaskValue[], readyAt: null | number): LongTaskSummaryValue => {
  const tasksBeforeReady = readyAt === null ? [] : tasks.filter(task => task.startAt < readyAt);

  return {
    count: tasksBeforeReady.length,
    excessMs: tasksBeforeReady.reduce((total, task) => total + Math.max(0, task.durationMs - LONG_TASK_THRESHOLD_MS), 0),
  };
};
