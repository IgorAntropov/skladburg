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

const createFixture = (maxRunsPerTick?: number): {
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
        id: `scheduled-${String(dueAtMs)}`,
        kind: DemoPersonaKind.BUYER,
        organizationId: SeedOrganizationId.BUYER_1,
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
  SeedPersonaId.FRESH_BUYER,
  SeedPersonaId.FRESH_SELLER,
  SeedPersonaId.FRESH_CARRIER,
  SeedPersonaId.FRESH_STOREKEEPER,
  SeedPersonaId.CONSTRUCTION_BUYER,
  SeedPersonaId.CONSTRUCTION_SELLER,
  SeedPersonaId.CONSTRUCTION_CARRIER,
  SeedPersonaId.CONSTRUCTION_STOREKEEPER,
].sort();
