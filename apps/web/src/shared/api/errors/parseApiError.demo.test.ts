import { fromJson } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  CreateWarehouseRequestSchema,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';
import type { ApiErrorValue } from './apiErrorTypes';

import { createApiRuntime } from '../runtime/createApiRuntime';
import { getFieldViolations } from './getFieldViolations';
import { getViolationMessageKey } from './getViolationMessageKey';
import { parseApiError } from './parseApiError';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const UNDEFINED_CAPABILITY_REQUEST = fromJson(CreateWarehouseRequestSchema, {
  capabilities: [0, 99],
  idempotencyKey: VALID_UUID,
  name: 'Склад',
});

const closers: (() => Promise<void>)[] = [];

const startRuntime = async (): Promise<ApiRuntimeValue> => {
  const inProcess = createInProcessEngineConnection();
  const runtime = await createApiRuntime({
    connection: inProcess.connection,
    defaultOrganizationId: SeedOrganizationId.CUSTOMER_1,
  });

  closers.push(async () => {
    runtime.close();
    await inProcess.close();
  });

  return runtime;
};

const captureApiError = async (call: Promise<unknown>): Promise<ApiErrorValue> => {
  const outcome = await call.then(
    () => undefined,
    (error: unknown) => ({ error }),
  );

  if (outcome === undefined) {
    throw new Error('The call was expected to fail');
  }

  return parseApiError(outcome.error);
};

const collectRuleIds = (error: ApiErrorValue): string[] => getFieldViolations(error).map(violation => violation.ruleId);

afterEach(async () => {
  for (const close of closers.splice(0)) {
    await close();
  }
});

describe('parseApiError against the demo engine', () => {
  it('reports permission_denied with the name of the missing permission', async () => {
    const runtime = await startRuntime();
    runtime.actingContext.set({ organizationId: SeedOrganizationId.CUSTOMER_1, userId: SeedUserId.STOREKEEPER_1 });

    const error = await captureApiError(runtime.client.organization.createWarehouse({
      idempotencyKey: VALID_UUID,
      name: 'Склад',
      timeZone: 'Europe/Moscow',
    }));

    expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(error.isRetryable).toBe(false);
    expect(error.traceId).toBeTruthy();
    expect(error.params.case === 'permissionDenied' && error.params.value.permission).toBe('warehouse_create');
  });

  it('reports validation_failed with the violations of the request', async () => {
    const runtime = await startRuntime();

    const error = await captureApiError(runtime.client.organization.createWarehouse({}));

    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.isRetryable).toBe(false);
    expect(getFieldViolations(error)).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldPath: 'idempotency_key', ruleId: 'string.uuid_empty' }),
      expect.objectContaining({ fieldPath: 'name', ruleId: 'string.min_len' }),
    ]));
  });

  it('gives every rule id the engine reports for the contract its own text', async () => {
    const runtime = await startRuntime();
    const reported = await Promise.all([
      captureApiError(runtime.client.organization.createWarehouse({})),
      captureApiError(runtime.client.organization.createWarehouse({
        address: 'a'.repeat(501),
        boardNodeId: 'not-a-uuid',
        capabilities: [WarehouseCapability.RAMP, WarehouseCapability.RAMP],
        cityId: VALID_UUID,
        idempotencyKey: VALID_UUID,
        name: 'n'.repeat(121),
        timeZone: 'moscow',
      })),
      captureApiError(runtime.client.organization.createWarehouse(UNDEFINED_CAPABILITY_REQUEST)),
      captureApiError(runtime.client.organization.listWarehouses({ page: { pageSize: 500, pageToken: '' } })),
    ]);
    const ruleIds = new Set(reported.flatMap(collectRuleIds));

    expect([...ruleIds].toSorted()).toEqual([
      'enum.defined_only',
      'enum.not_in',
      'int32.gte_lte',
      'repeated.unique',
      'string.max_len',
      'string.min_len',
      'string.pattern',
      'string.uuid',
      'string.uuid_empty',
    ]);

    for (const ruleId of ruleIds) {
      expect(getViolationMessageKey(ruleId), ruleId).toBe(`validation.${ruleId}`);
    }
  });

  it('maps an invalid page_token to the page_token.invalid text', async () => {
    const runtime = await startRuntime();

    const error = await captureApiError(runtime.client.organization.listWarehouses({
      page: { pageSize: 0, pageToken: 'no-such-token' },
    }));

    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(getFieldViolations(error)).toEqual([
      expect.objectContaining({ fieldPath: 'page.page_token', ruleId: 'page_token.invalid' }),
    ]);
    expect(getViolationMessageKey('page_token.invalid')).toBe('validation.page_token.invalid');
  });

  it('reports not_found for an organization that does not exist', async () => {
    const runtime = await startRuntime();

    const error = await captureApiError(runtime.client.organization.getOrganization({
      organizationId: VALID_UUID,
    }));

    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.isRetryable).toBe(false);
    expect(error.params.case === 'notFound' && error.params.value.entity).toBe(EntityKind.ORGANIZATION);
  });

  it('reports a failed transport without a detail as retryable unavailable', async () => {
    const inProcess = createInProcessEngineConnection();
    const runtime = await createApiRuntime({
      connection: {
        ...inProcess.connection,
        fetch: (input, init) => {
          if (new Request(input, init).url.endsWith('/ListWarehouses')) {
            return Promise.reject(new ConnectError('the engine is unavailable', Code.Unavailable));
          }

          return inProcess.connection.fetch(input, init);
        },
      },
      defaultOrganizationId: SeedOrganizationId.CUSTOMER_1,
    });
    closers.push(async () => {
      runtime.close();
      await inProcess.close();
    });

    const error = await captureApiError(runtime.client.organization.listWarehouses({}));

    expect(error).toMatchObject({ code: ErrorCode.UNAVAILABLE, isRetryable: true, traceId: undefined });
  });
});
