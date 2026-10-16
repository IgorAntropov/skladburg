import {
  describe,
  expect,
  it,
} from 'vitest';

import { summarizeLongTasks } from './summarizeLongTasks.ts';

describe('summarizeLongTasks', () => {
  it('counts tasks that started before the first screen and sums the time over 50 ms', () => {
    const summary = summarizeLongTasks(
      [
        { durationMs: 120, startAt: 300 },
        { durationMs: 70, startAt: 900 },
        { durationMs: 400, startAt: 2100 },
      ],
      2000,
    );

    expect(summary).toEqual({ count: 2, excessMs: 90 });
  });

  it('counts a task that began just before the ready moment and ended after it', () => {
    expect(summarizeLongTasks([{ durationMs: 200, startAt: 1990 }], 2000)).toEqual({ count: 1, excessMs: 150 });
  });

  it('never subtracts for a task at the threshold', () => {
    expect(summarizeLongTasks([{ durationMs: 50, startAt: 10 }], 100)).toEqual({ count: 1, excessMs: 0 });
  });

  it('reports nothing when the first screen was never reached', () => {
    expect(summarizeLongTasks([{ durationMs: 500, startAt: 10 }], null)).toEqual({ count: 0, excessMs: 0 });
  });
});
