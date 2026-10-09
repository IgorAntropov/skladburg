import type {
  Client,
  ServiceImpl,
} from '@connectrpc/connect';

import {
  Code,
  createClient,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { AccessService } from '@skladburg/contracts/access/v1/access';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IDomainErrors } from '../errors/index';

import {
  createEngineCaller,
  createTestEngine,
  createWarehouseRequest,
} from '../engine/testing/engineHarness';
import { createDomainErrors } from '../errors/index';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../modules/testing/moduleHarness';
import { createSeededRandom } from '../ports/index';
import { ENGINE_BASE_URL } from '../protocol';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/index';
import { createEngineHandler } from './engineRouter';

const KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

type GetSessionHandler = ServiceImpl<typeof AccessService>['getSession'];

const createHandlerClient = (errors: IDomainErrors, getSession: GetSessionHandler): Client<typeof AccessService> => {
  const unused = (): never => {
    throw new Error('not used');
  };
  const handler = createEngineHandler({
    accessService: { getSession, listPermissions: unused, listRoles: unused },
    clockService: { getWorldClock: unused },
    errors,
    organizationService: {
      createWarehouse: unused,
      getOrganization: unused,
      getOrganizationSettings: unused,
      listSpheres: unused,
      listWarehouses: unused,
    },
  });

  return createClient(AccessService, createConnectTransport({
    baseUrl: ENGINE_BASE_URL,
    fetch: (input, init) => handler(new Request(input, init)),
  }));
};

describe.each([
  ['binary', true],
  ['JSON', false],
])('engine protocol in the %s format', (_name, useBinaryFormat) => {
  it('lists exactly the warehouses of the acting organization', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine, useBinaryFormat);

    const response = await caller.organization.listWarehouses({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1));

    expect(response.warehouses.map(warehouse => warehouse.id).sort()).toEqual([
      SeedWarehouseId.BUYER_1_WAREHOUSE_1,
      SeedWarehouseId.BUYER_1_WAREHOUSE_2,
      SeedWarehouseId.BUYER_1_WAREHOUSE_3,
    ]);
  });

  it('returns the settings of the acting organization', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine, useBinaryFormat);

    const response = await caller.organization.getOrganizationSettings({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1));

    expect(response.settings?.organizationId).toBe(SeedOrganizationId.BUYER_1);
    expect(response.settings?.brandName).toBe('Покупатель 1');
    expect(response.settings?.defaultLocale).toBe('ru');
  });

  it('answers a write command with the created warehouse', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine, useBinaryFormat);

    const response = await caller.organization.createWarehouse(
      createWarehouseRequest(KEY),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1),
    );

    expect(response.warehouse?.tenantId).toBe(SeedOrganizationId.BUYER_1);
    expect(response.warehouse?.name).toBe('Склад 9');
  });

  it('delivers an access error as a ConnectError with the error detail', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine, useBinaryFormat);

    const error = await captureError(caller.organization.createWarehouse(
      createWarehouseRequest(KEY),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.BUYER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(error.rawMessage).toBe('permission_denied');
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.traceId).not.toBe('');
    expect(detail.params.case).toBe('permissionDenied');
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('warehouse_create');
  });

  it('delivers a missing session as unauthenticated', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine, useBinaryFormat);

    const error = await captureError(caller.access.getSession({}, callAs(undefined)));

    expect(error.code).toBe(Code.Unauthenticated);
    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('delivers validation violations with the rule ids', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine, useBinaryFormat);

    const error = await captureError(caller.organization.createWarehouse(
      createWarehouseRequest(KEY, { name: '' }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.InvalidArgument);
    expect(detail.code).toBe(ErrorCode.VALIDATION_FAILED);
    const violations = detail.params.case === 'validationFailed' ? detail.params.value.violations : [];
    const fieldPaths = violations.map(violation => violation.fieldPath);
    expect(fieldPaths).toContain('name');
  });
});

describe('engine router', () => {
  it('answers 404 for a path no handler serves', async () => {
    const { engine } = await createTestEngine();

    const response = await engine.handle(new Request(`${ENGINE_BASE_URL}/unknown.v1.UnknownService/Method`, {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }));

    expect(response.status).toBe(404);
  });

  it('serves the paths of all registered services', async () => {
    const { engine } = await createTestEngine();
    const bodyFor = (service: string, method: string): Promise<Response> => engine.handle(
      new Request(`${ENGINE_BASE_URL}/${service}/${method}`, {
        body: '{}',
        headers: { 'connect-protocol-version': '1', 'content-type': 'application/json' },
        method: 'POST',
      }),
    );

    const access = await bodyFor(AccessService.typeName, AccessService.method.getSession.name);
    const clock = await bodyFor(ClockService.typeName, ClockService.method.getWorldClock.name);
    const organization = await bodyFor(OrganizationService.typeName, OrganizationService.method.listSpheres.name);

    expect(access.status).toBe(401);
    expect(clock.status).toBe(401);
    expect(organization.status).toBe(401);
  });

  it('turns an unexpected exception of a handler into an internal error without leaking its text', async () => {
    const errors = createDomainErrors(createSeededRandom(1));
    const client = createHandlerClient(errors, () => {
      throw new Error('secret failure details');
    });

    const error = await captureError(client.getSession({}));

    expect(error.code).toBe(Code.Internal);
    expect(error.rawMessage).toBe('internal');
    expect(readErrorDetail(error).code).toBe(ErrorCode.INTERNAL);
    expect(readErrorDetail(error).traceId).not.toBe('');
  });

  it('keeps the error detail of a domain error thrown by a handler', async () => {
    const errors = createDomainErrors(createSeededRandom(1));
    const client = createHandlerClient(errors, () => {
      throw errors.membershipRequired();
    });

    const error = await captureError(client.getSession({}));

    expect(error.code).toBe(Code.PermissionDenied);
    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});
