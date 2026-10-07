import { create } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  type CreateWarehouseRequest,
  CreateWarehouseRequestSchema,
  type CreateWarehouseResponse,
  CreateWarehouseResponseSchema,
  OrganizationService,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../errors/index';
import { createSeededRandom } from '../ports/index';
import {
  createEmptySnapshot,
  createEngineState,
  type IEngineState,
} from '../state/index';
import {
  createLiveMeta,
  createTestWarehouse,
  TEST_WORLD_TIME_MS,
} from '../state/testRecords';
import {
  buildIdempotencyRecordId,
  createIdempotencyGuard,
  getMethodName,
  type IIdempotencyGuard,
} from './idempotencyGuard';

const KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_KEY = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const SCOPE = '10000001-0000-4000-8000-000000000000';
const OTHER_SCOPE = '10000002-0000-4000-8000-000000000000';
const CITY_ID = '60000001-0000-4000-8000-000000000000';
const NODE_ID = '70000001-0000-4000-8000-000000000000';
const METHOD = OrganizationService.method.createWarehouse;

const createRequest = (overrides: Partial<CreateWarehouseRequest> = {}): CreateWarehouseRequest => create(CreateWarehouseRequestSchema, {
  address: '',
  boardNodeId: NODE_ID,
  capabilities: [WarehouseCapability.RAMP],
  cityId: CITY_ID,
  idempotencyKey: KEY,
  name: 'Склад 1',
  timeZone: 'Europe/Moscow',
  ...overrides,
});

interface HarnessValue {
  createdWarehouseCount: () => number;
  guard: IIdempotencyGuard;
  run: (request: CreateWarehouseRequest, scope?: string) => { changeSetPuts: string[]; response: CreateWarehouseResponse };
  state: IEngineState;
}

const createHarness = (): HarnessValue => {
  const guard = createIdempotencyGuard(createDomainErrors(createSeededRandom(3)));
  const state = createEngineState(createEmptySnapshot());
  let handlerCalls = 0;

  const run = (request: CreateWarehouseRequest, scope = SCOPE): { changeSetPuts: string[]; response: CreateWarehouseResponse } => {
    const outcome = state.transact(TEST_WORLD_TIME_MS, transaction => guard.run(transaction, {
      handler: () => {
        handlerCalls += 1;
        const warehouse = createTestWarehouse(`wh-${String(handlerCalls)}`, scope, request.name);
        transaction.put('warehouses', warehouse);

        return create(CreateWarehouseResponseSchema, { warehouse });
      },
      idempotencyKey: request.idempotencyKey,
      method: METHOD,
      request,
      scope,
    }), createLiveMeta);
    outcome.apply();

    return { changeSetPuts: Object.keys(outcome.changeSet?.puts ?? {}).sort(), response: outcome.result };
  };

  return { createdWarehouseCount: () => handlerCalls, guard, run, state };
};

const captureError = (action: () => unknown): ConnectError => {
  try {
    action();
  }
  catch (error) {
    return ConnectError.from(error);
  }

  throw new Error('Expected the action to throw');
};

describe('createIdempotencyGuard', () => {
  it('runs the handler on the first call and records request and response in the same transaction', () => {
    const { createdWarehouseCount, run, state } = createHarness();
    const { changeSetPuts, response } = run(createRequest());

    expect(createdWarehouseCount()).toBe(1);
    expect(response.warehouse?.id).toBe('wh-1');
    expect(changeSetPuts).toEqual(['idempotency', 'warehouses']);
    expect(state.read.list('idempotency')).toHaveLength(1);
  });

  it('replays the stored response for the same key and the same body without running the handler', () => {
    const { createdWarehouseCount, run, state } = createHarness();
    const first = run(createRequest());
    const second = run(createRequest());

    expect(second.response).toEqual(first.response);
    expect(createdWarehouseCount()).toBe(1);
    expect(state.read.list('warehouses')).toHaveLength(1);
  });

  it('creates no change set on a replay', () => {
    const { run } = createHarness();
    run(createRequest());

    expect(run(createRequest()).changeSetPuts).toEqual([]);
  });

  it('rejects the same key with another body as idempotency_key_reused', () => {
    const { run } = createHarness();
    run(createRequest());

    const error = captureError(() => run(createRequest({ name: 'Склад 2' })));
    const [detail] = error.findDetails(ErrorDetailSchema);

    expect(detail?.code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect(error.rawMessage).toBe('idempotency_key_reused');
  });

  it('compares the whole body: any changed field with the same key is a reuse', () => {
    const { run } = createHarness();
    run(createRequest());

    expect(() => run(createRequest({ capabilities: [WarehouseCapability.COLD] }))).toThrow();
    expect(() => run(createRequest({ address: 'Адрес 1' }))).toThrow();
  });

  it('treats another key with the same body as a new command', () => {
    const { createdWarehouseCount, run, state } = createHarness();
    run(createRequest());
    run(createRequest({ idempotencyKey: OTHER_KEY }));

    expect(createdWarehouseCount()).toBe(2);
    expect(state.read.list('warehouses')).toHaveLength(2);
  });

  it('scopes keys by organization: the same key in another organization is a new command', () => {
    const { createdWarehouseCount, run } = createHarness();
    run(createRequest(), SCOPE);
    run(createRequest(), OTHER_SCOPE);

    expect(createdWarehouseCount()).toBe(2);
  });

  it('records nothing when the handler throws', () => {
    const { guard, state } = createHarness();

    expect(() => state.transact(TEST_WORLD_TIME_MS, transaction => guard.run(transaction, {
      handler: () => {
        throw new Error('handler failed');
      },
      idempotencyKey: KEY,
      method: METHOD,
      request: createRequest(),
      scope: SCOPE,
    }), createLiveMeta)).toThrow('handler failed');

    expect(state.read.list('idempotency')).toEqual([]);
  });

  it('allows the key to be used again with another body after a failed first attempt', () => {
    const { guard, run, state } = createHarness();

    expect(() => state.transact(TEST_WORLD_TIME_MS, transaction => guard.run(transaction, {
      handler: () => {
        throw new Error('handler failed');
      },
      idempotencyKey: KEY,
      method: METHOD,
      request: createRequest(),
      scope: SCOPE,
    }), createLiveMeta)).toThrow();

    expect(() => run(createRequest({ name: 'Склад 2' }))).not.toThrow();
  });
});

describe('idempotency record ids', () => {
  it('builds the id from the scope, the method and the key', () => {
    expect(buildIdempotencyRecordId('scope', 'method', 'key')).toBe('scope:method:key');
  });

  it('names the method by its service and name', () => {
    expect(getMethodName(METHOD)).toBe('organization.v1.OrganizationService/CreateWarehouse');
  });

  it('stores the record under that id', () => {
    const { run, state } = createHarness();
    run(createRequest());

    expect(state.read.get('idempotency', buildIdempotencyRecordId(SCOPE, getMethodName(METHOD), KEY))).toBeDefined();
  });
});
