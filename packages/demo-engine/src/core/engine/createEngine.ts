import { getContractRegistry } from '@skladburg/contracts/registry';

import type { EngineSubscriptionValue } from '../events/index';
import type { IModuleRuntime } from '../modules/index';
import type {
  EngineMetaValue,
  EngineSnapshotValue,
  IClock,
  IRealTimeSource,
} from '../ports/index';
import type { DemoPersonaListItemValue } from '../protocol';
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
  createClockService,
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
  type IStateReader,
  type LiveMetaValue,
} from '../state/index';
import { createRequestValidator } from '../validation/index';
import { createCommandQueue } from './commandQueue';
import {
  createCheckpointRunner,
  createCommandRunner,
} from './commandRunner';
import { createSwitchableRandom } from './switchableRandom';

const createClockFromMeta = (meta: EngineMetaValue, realTime: IRealTimeSource): IClock =>
  createScaledClock({ initial: { timeScale: meta.timeScale, worldTimeMs: meta.worldTimeMs }, realTime });

const compareIds = (current: string, prev: string): number => {
  if (current === prev) {
    return 0;
  }

  return current < prev ? -1 : 1;
};

const ROLE_NAME_SEPARATOR = ', ';
const ROLE_NAME_LOCALE = 'ru';

const readRoleName = (reader: IStateReader, organizationId: string, userId: string): string => {
  const names = new Set<string>();

  for (const membership of reader.listBy('memberships', 'userId', userId)) {
    if (membership.organizationId === organizationId) {
      for (const assignment of membership.roleAssignments) {
        const role = reader.get('roles', assignment.roleId);

        if (role !== undefined) {
          names.add(role.name);
        }
      }
    }
  }

  return [...names].sort((current, prev) => current.localeCompare(prev, ROLE_NAME_LOCALE)).join(ROLE_NAME_SEPARATOR);
};

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
  const readLiveMeta = (): LiveMetaValue => ({
    randomState: random.getState(),
    schedulerDueAtMs: scheduler.readDueAtMs(),
    timeScale: clock.getScale(),
    traceRandomState: traceRandom.getState(),
  });
  const readWorldTimeMs = (): number => clock.now();
  const command = createCommandRunner({
    bus,
    errors,
    readLiveMeta,
    readWorldTimeMs,
    state,
    storage,
  });
  const runCheckpoint = createCheckpointRunner({
    errors,
    readLiveMeta,
    readWorldTimeMs,
    state,
    storage,
  });
  const runtime: IModuleRuntime = {
    command,
    errors,
    guard: createCallGuard({ errors, validator: createRequestValidator(errors, getContractRegistry()) }),
    idempotency: createIdempotencyGuard(errors),
    outbox: bus.outbox,
    random,
    read: state.read,
  };
  const handler = createEngineHandler({
    accessService: createAccessService(runtime),
    clockService: createClockService(runtime, () => clock.getSnapshot()),
    errors,
    organizationService: createOrganizationService(runtime),
  });
  const scheduler = createScheduler({
    command,
    getWorldTimeMs: readWorldTimeMs,
    initialDueAtMs: snapshot.meta.schedulerDueAtMs,
  });
  const subscriptionAccess = createSubscriptionAccess(errors);
  const queue = createCommandQueue();

  for (const task of tasks) {
    scheduler.register(task);
  }

  const handle = (request: Request): Promise<Response> => queue.enqueue(() => handler(request));

  const tick = (): Promise<void> => queue.enqueue(() => scheduler.tick());

  const checkpoint = (): Promise<void> => queue.enqueue(runCheckpoint);

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

  const listPersonas = (): readonly DemoPersonaListItemValue[] => {
    const items: DemoPersonaListItemValue[] = [];

    for (const persona of state.read.list('personas')) {
      const organization = state.read.get('organizations', persona.organizationId);
      const user = state.read.get('users', persona.userId);

      if (organization !== undefined && user !== undefined) {
        items.push({
          group: persona.group,
          id: persona.id,
          kind: persona.kind,
          organizationId: persona.organizationId,
          organizationName: organization.name,
          roleName: readRoleName(state.read, persona.organizationId, persona.userId),
          userDisplayName: user.displayName,
          userId: persona.userId,
        });
      }
    }

    return items.sort((current, prev) => compareIds(current.id, prev.id));
  };

  const subscribe: IDemoEngine['subscribe'] = (channel, headers, listener): EngineSubscriptionValue => {
    const detail = subscriptionAccess.check(state.read, channel, headers);

    return detail === undefined
      ? {
          epoch,
          kind: 'subscribed',
          seq: state.getChannelSeq(channel),
          unsubscribe: bus.subscribe(channel, listener),
        }
      : { detail, kind: 'denied' };
  };

  return {
    checkpoint,
    epoch: () => epoch,
    getClockSnapshot: () => clock.getSnapshot(),
    handle,
    listPersonas,
    reset,
    subscribe,
    tick,
  };
};

export const createEngine = (options: CreateEngineOptionsValue): Promise<IDemoEngine> =>
  createEngineWithTasks(options, ENGINE_TASKS);
