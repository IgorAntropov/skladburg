import {
  create,
  toBinary,
  toJsonString,
} from '@bufbuild/protobuf';
import { Code } from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  type ErrorDetail,
} from '@skladburg/contracts/common/v1/error';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import {
  type CreateWarehouseRequest,
  CreateWarehouseRequestSchema,
  WarehouseCapability,
  WarehouseChange,
} from '@skladburg/contracts/organization/v1/organization';
import {
  organizationChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedBoardNodeId,
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { TEST_EPOCH } from '../testing/testRuntime';

const KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_KEY = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const createRequest = (overrides: Partial<CreateWarehouseRequest> = {}): CreateWarehouseRequest => create(CreateWarehouseRequestSchema, {
  address: 'ул. Вымышленная, 1',
  boardNodeId: SeedBoardNodeId.KAZAN,
  capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD],
  cityId: SeedCityId.KAZAN,
  idempotencyKey: KEY,
  name: 'Склад 9',
  timeZone: 'Europe/Moscow',
  ...overrides,
});

const getViolations = (detail: ErrorDetail): { fieldPath: string; ruleId: string }[] =>
  detail.params.case === 'validationFailed'
    ? detail.params.value.violations.map(violation => ({ fieldPath: violation.fieldPath, ruleId: violation.ruleId }))
    : [];

describe('OrganizationService.listWarehouses', () => {
  it('returns all warehouses of the organization to a user with an organization-wide role', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.listWarehouses({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.warehouses.map(warehouse => warehouse.id).sort()).toEqual([
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2,
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
    ]);
    expect(response.page?.nextPageToken).toBe('');
  });

  it('returns only the warehouse of the role area to a storekeeper', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.listWarehouses({}, callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.warehouses.map(warehouse => warehouse.id)).toEqual([SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1]);
  });

  it('returns the warehouses listed in the role assignment', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['warehouse_view'],
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3],
    });

    const response = await harness.organization.listWarehouses({}, callAs(userId, SeedOrganizationId.CUSTOMER_1));

    expect(response.warehouses.map(warehouse => warehouse.id).sort()).toEqual([
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2,
      SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
    ]);
  });

  it('never returns the warehouses of another organization', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.listWarehouses({}, callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2));

    expect(response.warehouses.map(warehouse => warehouse.id).sort()).toEqual([
      SeedWarehouseId.CUSTOMER_2_SITE_1,
      SeedWarehouseId.CUSTOMER_2_SITE_2,
    ]);
    expect(response.warehouses.every(warehouse => warehouse.tenantId === SeedOrganizationId.CUSTOMER_2)).toBe(true);
  });

  it('does not let a role point at a warehouse of another organization', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['warehouse_view'],
      warehouseIds: [SeedWarehouseId.CUSTOMER_2_SITE_1],
    });

    const response = await harness.organization.listWarehouses({}, callAs(userId, SeedOrganizationId.CUSTOMER_1));

    expect(response.warehouses).toEqual([]);
  });

  it('pages through the warehouses', async () => {
    const { organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    const first = await organization.listWarehouses({ page: { pageSize: 2 } }, options);
    const second = await organization.listWarehouses({ page: { pageSize: 2, pageToken: first.page?.nextPageToken } }, options);

    expect(first.warehouses).toHaveLength(2);
    expect(first.page?.nextPageToken).toBe(first.warehouses[1]?.id);
    expect(second.warehouses).toHaveLength(1);
    expect(second.page?.nextPageToken).toBe('');
  });

  it('rejects a user without the warehouse_view permission with permission_denied naming it', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['member_view'],
      warehouseIds: [],
    });

    const error = await captureError(harness.organization.listWarehouses({}, callAs(userId, SeedOrganizationId.CUSTOMER_1)));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('warehouse_view');
  });

  it('rejects a call without a user with session_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.listWarehouses({}, callAs(undefined, SeedOrganizationId.CUSTOMER_1)));

    expect(error.code).toBe(Code.Unauthenticated);
    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects a call without an organization with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.listWarehouses({}, callAs(SeedUserId.ADMIN_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a foreign acting organization with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.listWarehouses({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('OrganizationService.createWarehouse', () => {
  it('creates a warehouse of the acting organization and returns it', async () => {
    const { organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const created = await organization.createWarehouse(createRequest(), options);
    const listed = await organization.listWarehouses({}, options);

    expect(created.warehouse?.tenantId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(created.warehouse?.name).toBe('Склад 9');
    expect(created.warehouse?.cityId).toBe(SeedCityId.KAZAN);
    expect(created.warehouse?.capabilities).toEqual([WarehouseCapability.RAMP, WarehouseCapability.COLD]);
    expect(created.warehouse?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(listed.warehouses.map(warehouse => warehouse.id)).toContain(created.warehouse?.id);
    expect(listed.warehouses).toHaveLength(4);
  });

  it('gives the created warehouse to its organization only', async () => {
    const { organization } = createModuleHarness();

    await organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));
    const other = await organization.listWarehouses({}, callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2));

    expect(other.warehouses).toHaveLength(2);
  });

  it('publishes WarehouseChanged to the organization channel and WarehouseCreated to the warehouse channel in one command', async () => {
    const { clock, events, organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const created = await organization.createWarehouse(createRequest(), options);
    const warehouseId = created.warehouse?.id ?? '';
    const [changed, full] = events;

    expect(events).toHaveLength(2);
    expect(changed?.channel).toBe(organizationChannel(SeedOrganizationId.CUSTOMER_1));
    expect(changed?.seq).toBe(1n);
    expect(changed?.epoch).toBe(TEST_EPOCH);
    expect(changed?.payload.case).toBe('warehouseChanged');
    expect(changed?.payload.case === 'warehouseChanged' ? changed.payload.value.warehouseId : undefined).toBe(warehouseId);
    expect(changed?.payload.case === 'warehouseChanged' ? changed.payload.value.change : undefined).toBe(WarehouseChange.CREATED);
    expect(full?.channel).toBe(warehouseChannel(warehouseId));
    expect(full?.seq).toBe(1n);
    expect(full?.epoch).toBe(TEST_EPOCH);
    expect(full?.payload.case).toBe('warehouseCreated');
    expect(full?.payload.case === 'warehouseCreated' ? full.payload.value.warehouse : undefined).toEqual(created.warehouse);
    expect(changed?.occurredAt?.seconds).toBe(BigInt(Math.floor(clock.now() / 1000)));
    expect(full?.occurredAt).toEqual(changed?.occurredAt);
  });

  it('keeps the data of the warehouse out of the organization channel event', async () => {
    const { events, organization } = createModuleHarness();

    await organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));
    const [changed] = events;
    const thinEvent = changed === undefined ? '' : toJsonString(EventSchema, changed);
    const thinBytes = changed === undefined ? '' : new TextDecoder().decode(toBinary(EventSchema, changed));

    for (const text of [thinEvent, thinBytes]) {
      expect(text).not.toContain('Склад 9');
      expect(text).not.toContain('ул. Вымышленная, 1');
      expect(text).not.toContain('Europe/Moscow');
      expect(text).not.toContain(SeedCityId.KAZAN);
      expect(text).not.toContain(SeedBoardNodeId.KAZAN);
    }

    expect(changed?.payload.case === 'warehouseChanged' ? Object.keys(changed.payload.value).sort() : []).toEqual([
      '$typeName',
      'change',
      'warehouseId',
    ]);
  });

  it('numbers the events of every channel from its own sequence', async () => {
    const { events, organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const first = await organization.createWarehouse(createRequest(), options);
    const second = await organization.createWarehouse(createRequest({ idempotencyKey: OTHER_KEY, name: 'Склад 10' }), options);

    expect(events.map(event => [event.channel, event.seq])).toEqual([
      [organizationChannel(SeedOrganizationId.CUSTOMER_1), 1n],
      [warehouseChannel(first.warehouse?.id ?? ''), 1n],
      [organizationChannel(SeedOrganizationId.CUSTOMER_1), 2n],
      [warehouseChannel(second.warehouse?.id ?? ''), 1n],
    ]);
  });

  it('keeps the sequence of each organization channel independent', async () => {
    const { events, organization } = createModuleHarness();

    await organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));
    await organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2));

    expect(events.filter(event => event.channel.startsWith('org:')).map(event => [event.channel, event.seq])).toEqual([
      [organizationChannel(SeedOrganizationId.CUSTOMER_1), 1n],
      [organizationChannel(SeedOrganizationId.CUSTOMER_2), 1n],
    ]);
  });

  it('writes one commit per command', async () => {
    const { commits, organization } = createModuleHarness();

    await organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(commits).toHaveLength(1);
    expect(commits[0]?.puts.warehouses?.size).toBe(1);
    expect(commits[0]?.puts.idempotency?.size).toBe(1);
  });

  it('answers a repeated request with the same key by the same response, one warehouse and no new events', async () => {
    const { commits, events, organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const first = await organization.createWarehouse(createRequest(), options);
    const commitsAfterFirst = commits.length;
    const second = await organization.createWarehouse(createRequest(), options);
    const listed = await organization.listWarehouses({}, options);

    expect(second.warehouse?.id).toBe(first.warehouse?.id);
    expect(second).toEqual(first);
    expect(listed.warehouses).toHaveLength(4);
    expect(events).toHaveLength(2);
    expect(commits).toHaveLength(commitsAfterFirst);
  });

  it('scopes the key to the organization', async () => {
    const { organization } = createModuleHarness();

    const first = await organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));
    const second = await organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2));

    expect(second.warehouse?.id).not.toBe(first.warehouse?.id);
    expect(second.warehouse?.tenantId).toBe(SeedOrganizationId.CUSTOMER_2);
  });

  it('rejects the same key with another body with idempotency_key_reused', async () => {
    const { events, organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    await organization.createWarehouse(createRequest(), options);
    const error = await captureError(organization.createWarehouse(createRequest({ name: 'Склад 10' }), options));

    expect(error.code).toBe(Code.InvalidArgument);
    expect(readErrorDetail(error).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect(events).toHaveLength(2);
  });

  it('rejects an invalid body with validation_failed carrying the field path and the rule id', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest({ cityId: '', idempotencyKey: 'not-a-uuid', name: '' }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const violations = getViolations(readErrorDetail(error));

    expect(error.code).toBe(Code.InvalidArgument);
    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(violations).toEqual(expect.arrayContaining([
      { fieldPath: 'idempotency_key', ruleId: 'string.uuid' },
      { fieldPath: 'name', ruleId: 'string.min_len' },
      { fieldPath: 'city_id', ruleId: 'string.uuid_empty' },
    ]));
  });

  it('rejects an invalid time zone and unspecified capabilities', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest({ capabilities: [WarehouseCapability.UNSPECIFIED], timeZone: 'Moscow' }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const fieldPaths = getViolations(readErrorDetail(error)).map(violation => violation.fieldPath);

    expect(fieldPaths).toContain('time_zone');
    expect(fieldPaths).toContain('capabilities[0]');
  });

  it('writes nothing and sends no events when the body is invalid', async () => {
    const { commits, events, organization } = createModuleHarness();

    await captureError(organization.createWarehouse(
      createRequest({ name: '' }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(commits).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('answers not_found for a city that does not exist', async () => {
    const { commits, events, organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest({ cityId: UNKNOWN_ID }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.NotFound);
    expect(detail.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.CITY);
    expect(commits).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('answers not_found for a board node that does not exist', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest({ boardNodeId: UNKNOWN_ID }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(detail.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.BOARD_NODE);
  });

  it('answers not_found for a board node that belongs to another city', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest({ boardNodeId: SeedBoardNodeId.MOSCOW }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(detail.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.BOARD_NODE);
  });

  it('does not store the key of a failed command', async () => {
    const { organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    await captureError(organization.createWarehouse(createRequest({ cityId: UNKNOWN_ID }), options));
    const created = await organization.createWarehouse(createRequest(), options);

    expect(created.warehouse?.cityId).toBe(SeedCityId.KAZAN);
  });

  it('rejects a user without the warehouse_create permission with permission_denied naming it', async () => {
    const { commits, events, organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest(),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('warehouse_create');
    expect(commits).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('rejects a role with warehouse_create on one warehouse: creating a warehouse needs the whole organization', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['warehouse_create'],
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1],
    });
    const commitsBefore = harness.commits.length;
    const eventsBefore = harness.events.length;

    const error = await captureError(harness.organization.createWarehouse(createRequest(), callAs(userId, SeedOrganizationId.CUSTOMER_1)));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('warehouse_create');
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.warehouseId : undefined).toBe('');
    expect(harness.commits).toHaveLength(commitsBefore);
    expect(harness.events).toHaveLength(eventsBefore);
    expect(harness.state.read.list('warehouses').some(warehouse => warehouse.name === 'Склад 9')).toBe(false);
  });

  it('lets a role with warehouse_create for the whole organization create a warehouse', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['warehouse_create'],
      warehouseIds: [],
    });

    const response = await harness.organization.createWarehouse(createRequest(), callAs(userId, SeedOrganizationId.CUSTOMER_1));

    expect(response.warehouse?.tenantId).toBe(SeedOrganizationId.CUSTOMER_1);
  });

  it('checks access before the body: a denied user with an invalid body gets permission_denied', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest({ name: '' }),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('rejects a call without a user with session_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(createRequest(), callAs(undefined, SeedOrganizationId.CUSTOMER_1)));

    expect(error.code).toBe(Code.Unauthenticated);
    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects a call without an organization with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(createRequest(), callAs(SeedUserId.ADMIN_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a foreign acting organization with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.createWarehouse(
      createRequest(),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});
