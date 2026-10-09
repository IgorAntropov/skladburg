import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IStateTransaction } from '../state/index';
import type { SchedulerTaskValue } from './scheduler';

import { createEngineWithTasks } from '../engine/createEngine';
import {
  createFakeRealTime,
  createSpyStorage,
} from '../engine/testing/engineHarness';
import { createScaledClock } from '../ports/index';
import {
  createSeedSnapshot,
  DEFAULT_ENGINE_SEED,
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from '../seed/index';
import {
  createEngineState,
  DemoPersonaGroup,
  DemoPersonaKind,
} from '../state/index';
import { createLiveMeta } from '../state/testRecords';
import { createScheduler } from './scheduler';

const START_MS = 1_000;

const createTransaction = (): IStateTransaction =>
  createEngineState(createSeedSnapshot()).transact(
    START_MS,
    transaction => transaction,
    createLiveMeta,
  ).result;

const createFixture = (maxRunsPerTick?: number, initialDueAtMs?: Readonly<Record<string, number>>): {
  commandCount: () => number;
  realTime: ReturnType<typeof createFakeRealTime>;
  scheduler: ReturnType<typeof createScheduler>;
} => {
  const realTime = createFakeRealTime(0);
  const clock = createScaledClock({ initial: { timeScale: 1, worldTimeMs: START_MS }, realTime });
  const transaction = createTransaction();
  let commands = 0;
  const scheduler = createScheduler({
    command: (work) => {
      commands += 1;

      return Promise.resolve(work(transaction));
    },
    getWorldTimeMs: () => clock.now(),
    initialDueAtMs,
    maxRunsPerTick,
  });

  return { commandCount: () => commands, realTime, scheduler };
};

const createRecordingTask = (id: string, intervalMs: number, log: string[]): SchedulerTaskValue => ({
  id,
  intervalMs,
  run: () => {
    log.push(id);
  },
});

describe('createScheduler', () => {
  it('does nothing before a task is due', async () => {
    const { commandCount, realTime, scheduler } = createFixture();
    const run = vi.fn();
    scheduler.register({ id: 'task', intervalMs: 1_000, run });

    realTime.advance(999);
    await scheduler.tick();

    expect(run).not.toHaveBeenCalled();
    expect(commandCount()).toBe(0);
  });

  it('runs a due task once per elapsed interval, each run as its own command', async () => {
    const { commandCount, realTime, scheduler } = createFixture();
    const dueTimes: number[] = [];
    scheduler.register({
      id: 'task',
      intervalMs: 1_000,
      run: (_transaction, dueAtMs) => {
        dueTimes.push(dueAtMs);
      },
    });

    realTime.advance(3_500);
    await scheduler.tick();

    expect(dueTimes).toEqual([START_MS + 1_000, START_MS + 2_000, START_MS + 3_000]);
    expect(commandCount()).toBe(3);

    await scheduler.tick();

    expect(dueTimes).toHaveLength(3);

    realTime.advance(500);
    await scheduler.tick();

    expect(dueTimes).toHaveLength(4);
  });

  it('runs due tasks in the order of their due time, then of their registration', async () => {
    const { realTime, scheduler } = createFixture();
    const log: string[] = [];
    scheduler.register(createRecordingTask('slow', 2_000, log));
    scheduler.register(createRecordingTask('fast', 1_000, log));
    scheduler.register(createRecordingTask('twin', 2_000, log));

    realTime.advance(4_000);
    await scheduler.tick();

    expect(log).toEqual(['fast', 'slow', 'fast', 'twin', 'fast', 'slow', 'fast', 'twin']);
  });

  it('keeps running the other tasks and reschedules a task that failed', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { realTime, scheduler } = createFixture();
    const healthy = vi.fn();
    scheduler.register({
      id: 'broken',
      intervalMs: 1_000,
      run: () => {
        throw new Error('task failed');
      },
    });
    scheduler.register({ id: 'healthy', intervalMs: 1_000, run: healthy });

    realTime.advance(2_000);
    await scheduler.tick();

    expect(healthy).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it('limits the runs of one tick and leaves the rest due for the next one', async () => {
    const { realTime, scheduler } = createFixture(2);
    const run = vi.fn();
    scheduler.register({ id: 'task', intervalMs: 1_000, run });

    realTime.advance(5_000);
    await scheduler.tick();

    expect(run).toHaveBeenCalledTimes(2);

    await scheduler.tick();

    expect(run).toHaveBeenCalledTimes(4);
  });

  it('counts the next run from now after a restart', async () => {
    const { realTime, scheduler } = createFixture();
    const run = vi.fn();
    scheduler.register({ id: 'task', intervalMs: 1_000, run });
    realTime.advance(5_000);

    scheduler.restart();
    await scheduler.tick();

    expect(run).not.toHaveBeenCalled();

    realTime.advance(1_000);
    await scheduler.tick();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reports the due times of the registered tasks and moves a due time on when the task runs', async () => {
    const { realTime, scheduler } = createFixture();
    scheduler.register({ id: 'fast', intervalMs: 1_000, run: () => undefined });
    scheduler.register({ id: 'slow', intervalMs: 5_000, run: () => undefined });

    expect(scheduler.readDueAtMs()).toEqual({ fast: START_MS + 1_000, slow: START_MS + 5_000 });

    realTime.advance(1_000);
    await scheduler.tick();

    expect(scheduler.readDueAtMs()).toEqual({ fast: START_MS + 2_000, slow: START_MS + 5_000 });
  });

  it('takes the due time of a task from the restored deadlines and counts from now for a task without one', async () => {
    const { realTime, scheduler } = createFixture(undefined, { restored: START_MS + 300, stale: 1 });
    const restoredRun = vi.fn();
    const freshRun = vi.fn();
    scheduler.register({ id: 'restored', intervalMs: 1_000, run: restoredRun });
    scheduler.register({ id: 'fresh', intervalMs: 1_000, run: freshRun });

    expect(scheduler.readDueAtMs()).toEqual({ fresh: START_MS + 1_000, restored: START_MS + 300 });

    realTime.advance(300);
    await scheduler.tick();

    expect(restoredRun).toHaveBeenCalledTimes(1);
    expect(freshRun).not.toHaveBeenCalled();
  });

  it('ignores the restored deadlines on restart', () => {
    const { scheduler } = createFixture(undefined, { task: START_MS + 300 });
    scheduler.register({ id: 'task', intervalMs: 1_000, run: () => undefined });

    scheduler.restart();

    expect(scheduler.readDueAtMs()).toEqual({ task: START_MS + 1_000 });
  });

  it('rejects a duplicate id and an interval that is not a positive integer', () => {
    const { scheduler } = createFixture();
    scheduler.register({ id: 'task', intervalMs: 1_000, run: () => undefined });

    expect(() => {
      scheduler.register({ id: 'task', intervalMs: 1_000, run: () => undefined });
    }).toThrow(Error);
    expect(() => {
      scheduler.register({ id: 'zero', intervalMs: 0, run: () => undefined });
    }).toThrow(RangeError);
    expect(() => {
      scheduler.register({ id: 'fraction', intervalMs: 1.5, run: () => undefined });
    }).toThrow(RangeError);
  });
});

describe('engine tick', () => {
  const writingTask: SchedulerTaskValue = {
    id: 'writer',
    intervalMs: 1_000,
    run: (transaction, dueAtMs) => {
      transaction.put('personas', {
        group: DemoPersonaGroup.FRESH,
        id: `scheduled-${String(dueAtMs)}`,
        kind: DemoPersonaKind.CUSTOMER,
        organizationId: SeedOrganizationId.CUSTOMER_1,
        userId: SeedUserId.ADMIN_1,
      });
    },
  };

  it('runs a task through the engine runtime with one commit per run and stores the world time with it', async () => {
    const realTime = createFakeRealTime(0);
    const storage = createSpyStorage();
    const engine = await createEngineWithTasks({ epoch: 'e', realTime, storage }, [writingTask]);

    realTime.advance(2_000);
    await engine.tick();

    expect(storage.commits).toHaveLength(2);
    expect(storage.commits.map(commit => commit.meta.worldTimeMs)).toEqual([
      DEFAULT_ENGINE_SEED.worldStartMs + 2_000,
      DEFAULT_ENGINE_SEED.worldStartMs + 2_000,
    ]);
    expect(engine.listPersonas().map(persona => persona.id)).toContain(`scheduled-${String(DEFAULT_ENGINE_SEED.worldStartMs + 2_000)}`);
  });

  it('does not commit when no task is due or a task changes nothing, so the stored world time stays at the last commit', async () => {
    const realTime = createFakeRealTime(0);
    const storage = createSpyStorage();
    const engine = await createEngineWithTasks({ epoch: 'e', realTime, storage }, [{
      id: 'idle',
      intervalMs: 1_000,
      run: () => undefined,
    }]);

    await engine.tick();
    realTime.advance(3_000);
    await engine.tick();

    expect(storage.commits).toHaveLength(0);
    expect((await storage.load())?.meta.worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs);
    expect(engine.getClockSnapshot().worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 3_000);
  });

  it('restarts the schedule on reset', async () => {
    const realTime = createFakeRealTime(0);
    const storage = createSpyStorage();
    const engine = await createEngineWithTasks({ epoch: 'e', realTime, storage }, [writingTask]);

    realTime.advance(5_000);
    await engine.reset('e2');
    await engine.tick();

    expect(storage.commits).toHaveLength(0);
    expect(engine.listPersonas().map(persona => persona.id).sort()).toEqual(createSeedSnapshotPersonaIds());
  });
});

const createSeedSnapshotPersonaIds = (): string[] => [
  SeedPersonaId.FRESH_CUSTOMER,
  SeedPersonaId.FRESH_SUPPLIER,
  SeedPersonaId.FRESH_CARRIER,
  SeedPersonaId.FRESH_STOREKEEPER,
  SeedPersonaId.CONSTRUCTION_CUSTOMER,
  SeedPersonaId.CONSTRUCTION_SUPPLIER,
  SeedPersonaId.CONSTRUCTION_CARRIER,
  SeedPersonaId.CONSTRUCTION_STOREKEEPER,
].sort();

describe('engine scheduler deadlines', () => {
  const idleTask: SchedulerTaskValue = {
    id: 'writer',
    intervalMs: 1_000,
    run: (transaction, dueAtMs) => {
      transaction.put('personas', {
        group: DemoPersonaGroup.FRESH,
        id: `scheduled-${String(dueAtMs)}`,
        kind: DemoPersonaKind.CUSTOMER,
        organizationId: SeedOrganizationId.CUSTOMER_1,
        userId: SeedUserId.ADMIN_1,
      });
    },
  };

  const startMs = DEFAULT_ENGINE_SEED.worldStartMs;

  it('writes the next due time of the task with every commit and with a checkpoint', async () => {
    const realTime = createFakeRealTime(0);
    const storage = createSpyStorage();
    const engine = await createEngineWithTasks({ epoch: 'e', realTime, storage }, [idleTask]);

    realTime.advance(1_000);
    await engine.tick();
    realTime.advance(400);
    await engine.checkpoint();

    expect(storage.commits.map(commit => commit.meta.schedulerDueAtMs)).toEqual([
      { writer: startMs + 2_000 },
      { writer: startMs + 2_000 },
    ]);
    expect(storage.commits[1]?.meta.worldTimeMs).toBe(startMs + 1_400);
  });

  it('keeps the due time and does not go back in world time after a restart on the same storage', async () => {
    const firstRealTime = createFakeRealTime(0);
    const storage = createSpyStorage();
    const first = await createEngineWithTasks({ epoch: 'e', realTime: firstRealTime, storage }, [idleTask]);
    firstRealTime.advance(600);
    await first.checkpoint();
    const checkpointWorldTimeMs = first.getClockSnapshot().worldTimeMs;

    const secondRealTime = createFakeRealTime(50_000);
    const second = await createEngineWithTasks({ epoch: 'e2', realTime: secondRealTime, storage }, [idleTask]);

    expect(second.getClockSnapshot().worldTimeMs).toBeGreaterThanOrEqual(checkpointWorldTimeMs);
    secondRealTime.advance(399);
    await second.tick();

    expect(storage.commits).toHaveLength(1);

    secondRealTime.advance(1);
    await second.tick();

    expect(storage.commits).toHaveLength(2);
    expect(storage.commits[1]?.meta.schedulerDueAtMs).toEqual({ writer: startMs + 2_000 });
    expect(second.listPersonas().map(persona => persona.id)).toContain(`scheduled-${String(startMs + 1_000)}`);
  });

  it('counts a task that has no stored deadline from the world time of the start', async () => {
    const firstRealTime = createFakeRealTime(0);
    const storage = createSpyStorage();
    const first = await createEngineWithTasks({ epoch: 'e', realTime: firstRealTime, storage }, []);
    firstRealTime.advance(600);
    await first.checkpoint();

    const secondRealTime = createFakeRealTime(0);
    const second = await createEngineWithTasks({ epoch: 'e2', realTime: secondRealTime, storage }, [idleTask]);
    secondRealTime.advance(999);
    await second.tick();

    expect(storage.commits).toHaveLength(1);

    secondRealTime.advance(1);
    await second.tick();

    expect(storage.commits).toHaveLength(2);
  });

  it('counts the deadlines from now on reset and stores them with the next checkpoint', async () => {
    const realTime = createFakeRealTime(0);
    const storage = createSpyStorage();
    const engine = await createEngineWithTasks({ epoch: 'e', realTime, storage }, [idleTask]);
    realTime.advance(5_000);
    await engine.tick();

    await engine.reset('e2');
    realTime.advance(100);
    await engine.checkpoint();

    expect(storage.commits.at(-1)?.meta.schedulerDueAtMs).toEqual({ writer: startMs + 1_000 });
    expect((await storage.load())?.meta.schedulerDueAtMs).toEqual({ writer: startMs + 1_000 });
  });
});
