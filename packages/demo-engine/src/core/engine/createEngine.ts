import type { EngineSubscriptionValue } from '../events/index';
import type { IModuleRuntime } from '../modules/index';
import type {
  EngineMetaValue,
  EngineSnapshotValue,
  IClock,
  IRealTimeSource,
} from '../ports/index';
import type { SchedulerTaskValue } from '../scheduler/index';
import type {
  CreateEngineOptionsValue,
  IDemoEngine,
} from './engineTypes';

import { createCallGuard } from '../access/index';
import { createDomainErrors } from '../errors/index';
import {
  createEventBus,
  createSubscriptionAccess,
} from '../events/index';
import { createIdempotencyGuard } from '../idempotency/index';
import {
  createAccessService,
  createOrganizationService,
} from '../modules/index';
import {
  createRandom,
  createScaledClock,
} from '../ports/index';
import { createEngineHandler } from '../router/index';
import {
  createScheduler,
  ENGINE_TASKS,
} from '../scheduler/index';
import {
  createSeedSnapshot,
  SEED_VERSION,
} from '../seed/index';
import {
  createEngineState,
  isCurrentSnapshot,
} from '../state/index';
import { createRequestValidator } from '../validation/index';
import { createCommandQueue } from './commandQueue';
import { createCommandRunner } from './commandRunner';
import { createSwitchableRandom } from './switchableRandom';

const createClockFromMeta = (meta: EngineMetaValue, realTime: IRealTimeSource): IClock =>
  createScaledClock({ initial: { timeScale: meta.timeScale, worldTimeMs: meta.worldTimeMs }, realTime });

const loadOrSeedSnapshot = async (options: CreateEngineOptionsValue): Promise<EngineSnapshotValue> => {
  const stored = await options.storage.load();

  if (isCurrentSnapshot(stored, SEED_VERSION)) {
    return stored;
  }

  const seeded = createSeedSnapshot(options.seed);
  await options.storage.replaceAll(seeded);

  return seeded;
};

export const createEngineWithTasks = async (
  options: CreateEngineOptionsValue,
  tasks: readonly SchedulerTaskValue[],
): Promise<IDemoEngine> => {
  const { realTime, storage } = options;
  const snapshot = await loadOrSeedSnapshot(options);
  let epoch = options.epoch;
  let clock = createClockFromMeta(snapshot.meta, realTime);
  const random = createSwitchableRandom(createRandom(snapshot.meta.randomState));
  const traceRandom = createSwitchableRandom(createRandom(snapshot.meta.traceRandomState));
  const state = createEngineState(snapshot);
  const errors = createDomainErrors(traceRandom);
  const bus = createEventBus({ getEpoch: () => epoch });
  const command = createCommandRunner({
    bus,
    errors,
    readLiveMeta: () => ({
      randomState: random.getState(),
      timeScale: clock.getScale(),
      traceRandomState: traceRandom.getState(),
    }),
    readWorldTimeMs: () => clock.now(),
    state,
    storage,
  });
  const runtime: IModuleRuntime = {
    command,
    errors,
    guard: createCallGuard({ errors, validator: createRequestValidator(errors) }),
    idempotency: createIdempotencyGuard(errors),
    outbox: bus.outbox,
    random,
    read: state.read,
  };
  const handler = createEngineHandler({
    accessService: createAccessService(runtime),
    errors,
    organizationService: createOrganizationService(runtime),
  });
  const scheduler = createScheduler({ command, getWorldTimeMs: () => clock.now() });
  const subscriptionAccess = createSubscriptionAccess(errors);
  const queue = createCommandQueue();

  for (const task of tasks) {
    scheduler.register(task);
  }

  const handle = (request: Request): Promise<Response> => queue.enqueue(() => handler(request));

  const tick = (): Promise<void> => queue.enqueue(() => scheduler.tick());

  const reset = (nextEpoch: string): Promise<void> => queue.enqueue(async () => {
    const seeded = createSeedSnapshot(options.seed);
    await storage.replaceAll(seeded);
    state.replaceAll(seeded);
    clock = createClockFromMeta(seeded.meta, realTime);
    random.replace(createRandom(seeded.meta.randomState));
    traceRandom.replace(createRandom(seeded.meta.traceRandomState));
    epoch = nextEpoch;
    scheduler.restart();
  });

  const subscribe: IDemoEngine['subscribe'] = (channel, headers, listener): EngineSubscriptionValue => {
    const detail = subscriptionAccess.check(state.read, channel, headers);

    return detail === undefined
      ? { kind: 'subscribed', unsubscribe: bus.subscribe(channel, listener) }
      : { detail, kind: 'denied' };
  };

  return {
    epoch: () => epoch,
    getClockSnapshot: () => clock.getSnapshot(),
    handle,
    listPersonas: () => state.read.list('personas'),
    reset,
    subscribe,
    tick,
  };
};

export const createEngine = (options: CreateEngineOptionsValue): Promise<IDemoEngine> =>
  createEngineWithTasks(options, ENGINE_TASKS);
