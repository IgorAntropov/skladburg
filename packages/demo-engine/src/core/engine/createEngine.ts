import type { FileRegistry } from '@bufbuild/protobuf';

import { base64Decode } from '@bufbuild/protobuf/wire';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';
import {
  COMPRESSED_CONTRACT_IMAGE_BASE64,
  createContractRegistry,
} from '@skladburg/contracts/registry';

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
import { createDealDeadlines } from '../modules/deals/dealDeadlines';
import {
  createDeferredDocumentService,
  loadDocuments,
} from '../modules/documents/loadDocuments';
import {
  createAccessService,
  createCatalogService,
  createCatalogShowcaseService,
  createClockService,
  createDealService,
  createImportService,
  createNetworkService,
  createNotificationService,
  createNotifier,
  createOrganizationRequisitesService,
  createOrganizationService,
  createOrganizationShowcaseService,
  createSupportAccessService,
  createSupportTicketService,
  createUserProfileService,
} from '../modules/index';
import { createDemoPaymentProvider } from '../modules/payments/demoPaymentProvider';
import {
  createDeferredPaymentService,
  createDeferredPaymentTask,
  loadPayments,
} from '../modules/payments/loadPayments';
import {
  createRandom,
  createScaledClock,
} from '../ports/index';
import {
  createEngineHandler,
  createSupportAuditInterceptor,
} from '../router/index';
import {
  createEngineTasks,
  createScheduler,
} from '../scheduler/index';
import {
  type EngineSeedValue,
  SEED_VERSION,
} from '../seed/seedConfig';
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
import { SeedLoadError } from './SeedLoadError';
import { createSwitchableRandom } from './switchableRandom';

let contractRegistry: FileRegistry | undefined;

const getEngineContractRegistry = async (): Promise<FileRegistry> => {
  if (contractRegistry === undefined) {
    const compressed = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start: (controller) => {
        controller.enqueue(Uint8Array.from(base64Decode(COMPRESSED_CONTRACT_IMAGE_BASE64)));
        controller.close();
      },
    });
    const stream = compressed.pipeThrough(new DecompressionStream('deflate'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    contractRegistry = createContractRegistry(bytes);
  }
  return contractRegistry;
};

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

const loadSeedSnapshot = async (seed: EngineSeedValue | undefined): Promise<EngineSnapshotValue> => {
  let module: typeof import('../seed/seedSnapshot');

  try {
    module = await import('../seed/seedSnapshot');
  }
  catch (error) {
    throw new SeedLoadError(error);
  }

  return module.createSeedSnapshot(seed);
};

const loadOrSeedSnapshot = async (
  options: CreateEngineOptionsValue,
  loadSeed: typeof loadSeedSnapshot,
): Promise<EngineSnapshotValue> => {
  const stored = await options.storage.load();

  if (isCurrentSnapshot(stored, SEED_VERSION)) {
    return stored;
  }

  const seeded = await loadSeed(options.seed);
  await options.storage.replaceAll(seeded);

  return seeded;
};

export const createEngineWithTasks = async (
  options: CreateEngineOptionsValue,
  createTasks: (runtime: IModuleRuntime) => readonly SchedulerTaskValue[],
  loadSeed = loadSeedSnapshot,
): Promise<IDemoEngine> => {
  const { realTime, storage } = options;
  const snapshot = await loadOrSeedSnapshot(options, loadSeed);
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
  const validator = createRequestValidator(errors, await getEngineContractRegistry());
  const runtime: IModuleRuntime = {
    command,
    errors,
    getWorldTimeMs: readWorldTimeMs,
    guard: createCallGuard({
      errors,
      getWorldTimeMs: readWorldTimeMs,
      validator,
    }),
    idempotency: createIdempotencyGuard(errors),
    notifier: createNotifier({ outbox: bus.outbox, random }),
    outbox: bus.outbox,
    paymentProvider: createDemoPaymentProvider(random),
    random,
    read: state.read,
  };
  const handler = createEngineHandler({
    accessService: createAccessService(runtime),
    catalogService: createCatalogService(runtime),
    catalogShowcaseService: createCatalogShowcaseService(runtime),
    clockService: createClockService(runtime, () => clock.getSnapshot()),
    dealService: createDealService(runtime),
    documentService: createDeferredDocumentService(runtime),
    errors,
    importService: createImportService(runtime, validator),
    networkService: createNetworkService(runtime),
    notificationService: createNotificationService(runtime),
    organizationRequisitesService: createOrganizationRequisitesService(runtime),
    organizationService: createOrganizationService(runtime),
    organizationShowcaseService: createOrganizationShowcaseService(runtime),
    paymentService: createDeferredPaymentService(runtime),
    supportAccessService: createSupportAccessService(runtime),
    supportAudit: createSupportAuditInterceptor(runtime),
    supportTicketService: createSupportTicketService(runtime),
    userProfileService: createUserProfileService(runtime),
  });
  const scheduler = createScheduler({
    command,
    getWorldTimeMs: readWorldTimeMs,
    initialDueAtMs: snapshot.meta.schedulerDueAtMs,
  });
  const subscriptionAccess = createSubscriptionAccess(errors);
  const queue = createCommandQueue();

  for (const task of createTasks(runtime)) {
    scheduler.register(task);
  }

  const legacyDeals = state.read.list('deals').filter(
    deal => deal.status === DealStatus.LOGISTICS_CHOSEN && state.read.listBy('documents', 'dealId', deal.id).length === 0,
  );
  if (legacyDeals.length > 0) {
    const { restoreDealDocuments } = await loadDocuments();
    await restoreDealDocuments(runtime, legacyDeals);
  }

  const legacyAwaitingPayment = state.read.list('deals').filter(
    deal => deal.status === DealStatus.AWAITING_PAYMENT && deal.deadlines?.paymentDueAt === undefined,
  );
  if (legacyAwaitingPayment.length > 0) {
    await command((transaction) => {
      for (const deal of legacyAwaitingPayment) {
        const signedAt = deal.updatedAt === undefined ? transaction.worldTimeMs : timestampMs(deal.updatedAt);
        const deadlines = createDealDeadlines(runtime, transaction, deal, 'payment', signedAt);
        if (deadlines.paymentDueAt !== undefined) {
          transaction.put('deals', { ...deal, deadlines });
        }
      }
    });
  }

  if (state.read.list('payments').some(record => record.bankDueAt !== undefined
    || record.payment?.status === SafeDealPaymentStatus.HELD)) {
    await loadPayments();
  }

  const handle = (request: Request): Promise<Response> => queue.enqueue(() => handler(request));

  const tick = (): Promise<void> => queue.enqueue(() => scheduler.tick());

  const checkpoint = (): Promise<void> => queue.enqueue(runCheckpoint);

  const reset = (nextEpoch: string): Promise<void> => queue.enqueue(async () => {
    const seeded = await loadSeed(options.seed);
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
          ...(user.avatarUrl === '' ? {} : { userAvatarUrl: user.avatarUrl }),
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

const loadDemoSeedSnapshot = async (seed: EngineSeedValue | undefined): Promise<EngineSnapshotValue> => {
  const snapshot = await loadSeedSnapshot(seed);

  if (seed !== undefined) {
    return snapshot;
  }

  try {
    const { addSeedDealHistory } = await import('../seed/seedDealHistory');

    return await addSeedDealHistory(snapshot, (storage, realTime) =>
      createEngineWithTasks({ epoch: 'seed', realTime, storage }, runtime => [createDeferredPaymentTask(runtime)]));
  }
  catch (error) {
    throw new SeedLoadError(error);
  }
};

export const createEngine = (options: CreateEngineOptionsValue): Promise<IDemoEngine> =>
  createEngineWithTasks(options, createEngineTasks, loadDemoSeedSnapshot);
