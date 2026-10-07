import type {
  CallOptions,
  Client,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  createClient,
  type Transport,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { AccessService } from '@skladburg/contracts/access/v1/access';
import {
  type CreateWarehouseRequest,
  CreateWarehouseRequestSchema,
  OrganizationService,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';

import type {
  EngineChangeSetValue,
  EngineSnapshotValue,
  IEngineStorage,
  IRealTimeSource,
} from '../../ports/index';
import type {
  CreateEngineOptionsValue,
  IDemoEngine,
} from '../engineTypes';

import { callAs } from '../../modules/testing/moduleHarness';
import { createMemoryStorage } from '../../ports/index';
import {
  DEMO_USER_HEADER,
  ENGINE_BASE_URL,
} from '../../protocol';
import {
  SeedBoardNodeId,
  SeedCityId,
} from '../../seed/index';
import { createEngine } from '../createEngine';

export const TEST_ENGINE_EPOCH = 'epoch-1';
export const WORLD_REAL_TIME_START_MS = 1_000_000;

export interface EngineCallerValue {
  access: Client<typeof AccessService>;
  options: (userId: string | undefined, organizationId?: string) => CallOptions;
  organization: Client<typeof OrganizationService>;
}

export interface FakeRealTimeValue extends IRealTimeSource {
  advance: (deltaMs: number) => void;
}

export interface SpyStorageValue extends IEngineStorage {
  commits: EngineChangeSetValue[];
  failNextCommit: () => void;
  failNextReplaceAll: () => void;
  gateCommits: () => (() => void);
  loadCount: () => number;
  replaceAllCount: () => number;
}

export interface TestEngineValue {
  engine: IDemoEngine;
  realTime: FakeRealTimeValue;
  storage: SpyStorageValue;
}

export const createFakeRealTime = (startMs: number = WORLD_REAL_TIME_START_MS): FakeRealTimeValue => {
  let currentMs = startMs;

  return {
    advance: (deltaMs) => {
      currentMs += deltaMs;
    },
    now: () => currentMs,
  };
};

const MICROTASK_ROUNDS = 50;

export const settleMicrotasks = async (): Promise<void> => {
  for (let round = 0; round < MICROTASK_ROUNDS; round += 1) {
    await Promise.resolve();
  }
};

export const createSpyStorage = (initial?: EngineSnapshotValue): SpyStorageValue => {
  const inner = createMemoryStorage(initial);
  const commits: EngineChangeSetValue[] = [];
  let loads = 0;
  let replaces = 0;
  let isFailureArmed = false;
  let isReplaceFailureArmed = false;
  let gate: Promise<void> | undefined;

  return {
    commit: async (changeSet) => {
      if (gate !== undefined) {
        await gate;
      }

      if (isFailureArmed) {
        isFailureArmed = false;
        throw new Error('The storage rejected the commit');
      }

      commits.push(changeSet);
      await inner.commit(changeSet);
    },
    commits,
    failNextCommit: () => {
      isFailureArmed = true;
    },
    failNextReplaceAll: () => {
      isReplaceFailureArmed = true;
    },
    gateCommits: () => {
      let release: () => void = () => undefined;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });

      return () => {
        gate = undefined;
        release();
      };
    },
    load: () => {
      loads += 1;

      return inner.load();
    },
    loadCount: () => loads,
    replaceAll: (snapshot) => {
      if (isReplaceFailureArmed) {
        isReplaceFailureArmed = false;

        return Promise.reject(new Error('The storage rejected the replacement'));
      }

      replaces += 1;

      return inner.replaceAll(snapshot);
    },
    replaceAllCount: () => replaces,
  };
};

export const createTestEngine = async (
  overrides: Partial<CreateEngineOptionsValue> & { storage?: SpyStorageValue } = {},
): Promise<TestEngineValue> => {
  const realTime = createFakeRealTime();
  const storage = overrides.storage ?? createSpyStorage();
  const engine = await createEngine({
    epoch: TEST_ENGINE_EPOCH,
    realTime,
    ...overrides,
    storage,
  });

  return { engine, realTime, storage };
};

export const createEngineTransport = (engine: IDemoEngine, useBinaryFormat: boolean): Transport => createConnectTransport({
  baseUrl: ENGINE_BASE_URL,
  fetch: (input, init) => engine.handle(new Request(input, init)),
  useBinaryFormat,
});

export const createEngineCaller = (engine: IDemoEngine, useBinaryFormat = true): EngineCallerValue => {
  const transport = createEngineTransport(engine, useBinaryFormat);

  return {
    access: createClient(AccessService, transport),
    options: callAs,
    organization: createClient(OrganizationService, transport),
  };
};

export const createWarehouseRequest = (idempotencyKey: string, overrides: Partial<CreateWarehouseRequest> = {}): CreateWarehouseRequest =>
  create(CreateWarehouseRequestSchema, {
    address: 'ул. Вымышленная, 1',
    boardNodeId: SeedBoardNodeId.KAZAN,
    capabilities: [WarehouseCapability.RAMP],
    cityId: SeedCityId.KAZAN,
    idempotencyKey,
    name: 'Склад 9',
    timeZone: 'Europe/Moscow',
    ...overrides,
  });

export const createHeaders = (userId: string | undefined, organizationId?: string): Headers => {
  const headers = new Headers();

  if (userId !== undefined) {
    headers.set(DEMO_USER_HEADER, userId);
  }

  if (organizationId !== undefined) {
    headers.set(ACTING_ORGANIZATION_HEADER, organizationId);
  }

  return headers;
};
