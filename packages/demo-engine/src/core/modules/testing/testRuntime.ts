import type { Event } from '@skladburg/contracts/event/v1/event';

import type { IEventBus } from '../../events/index';
import type {
  EngineChangeSetValue,
  IClock,
  IEngineStorage,
  IRandom,
} from '../../ports/index';
import type { IEngineState } from '../../state/index';
import type {
  IEventOutbox,
  IModuleRuntime,
} from '../moduleRuntime';

import { createCallGuard } from '../../access/index';
import { createCommandRunner } from '../../engine/index';
import { createDomainErrors } from '../../errors/index';
import { createEventBus } from '../../events/index';
import { createIdempotencyGuard } from '../../idempotency/index';
import {
  createMemoryStorage,
  createRandom,
  createScaledClock,
} from '../../ports/index';
import {
  createSeedSnapshot,
  SEED_WORLD_START_MS,
} from '../../seed/index';
import { createEngineState } from '../../state/index';
import { createRequestValidator } from '../../validation/index';

export const TEST_EPOCH = 'test-epoch';

export interface TestRuntimeValue {
  clock: IClock;
  commits: EngineChangeSetValue[];
  events: Event[];
  random: IRandom;
  runtime: IModuleRuntime;
  state: IEngineState;
  storage: IEngineStorage;
}

const createCollectingOutbox = (bus: IEventBus, events: Event[]): IEventOutbox => {
  const collectedChannels = new Set<string>();

  return {
    add: (transaction, channel, payload) => {
      if (!collectedChannels.has(channel)) {
        collectedChannels.add(channel);
        bus.subscribe(channel, (published) => {
          events.push(...published);
        });
      }

      bus.outbox.add(transaction, channel, payload);
    },
  };
};

export const createTestRuntime = (): TestRuntimeValue => {
  const snapshot = createSeedSnapshot();
  const state = createEngineState(snapshot);
  const memoryStorage = createMemoryStorage(snapshot);
  const commits: EngineChangeSetValue[] = [];
  const events: Event[] = [];
  const random = createRandom(snapshot.meta.randomState);
  const clock = createScaledClock({
    initial: { timeScale: 1, worldTimeMs: SEED_WORLD_START_MS },
    realTime: { now: () => 0 },
  });
  const traceRandom = createRandom(snapshot.meta.traceRandomState);
  const errors = createDomainErrors(traceRandom);
  const bus = createEventBus({ getEpoch: () => TEST_EPOCH });

  const storage: IEngineStorage = {
    commit: async (changeSet) => {
      commits.push(changeSet);
      await memoryStorage.commit(changeSet);
    },
    load: memoryStorage.load,
    replaceAll: memoryStorage.replaceAll,
  };

  const runtime: IModuleRuntime = {
    command: createCommandRunner({
      bus,
      errors,
      readLiveMeta: () => ({
        randomState: random.getState(),
        schedulerDueAtMs: {},
        timeScale: clock.getScale(),
        traceRandomState: traceRandom.getState(),
      }),
      readWorldTimeMs: () => clock.now(),
      state,
      storage,
    }),
    errors,
    guard: createCallGuard({ errors, validator: createRequestValidator(errors) }),
    idempotency: createIdempotencyGuard(errors),
    outbox: createCollectingOutbox(bus, events),
    random,
    read: state.read,
  };

  return { clock, commits, events, random, runtime, state, storage };
};
