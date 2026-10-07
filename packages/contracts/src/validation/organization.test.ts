import {
  create,
  fromJson,
} from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { PageRequestSchema } from '../gen/common/v1/page_pb';
import {
  type CreateWarehouseRequest,
  CreateWarehouseRequestSchema,
  GetOrganizationRequestSchema,
  ListSpheresRequestSchema,
  ListWarehousesRequestSchema,
  WarehouseCapability,
} from '../gen/organization/v1/organization_pb';
import { collectViolations } from './collectViolations';

const validUuid = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const otherUuid = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const createWarehouseRequest = (overrides: Partial<CreateWarehouseRequest> = {}): CreateWarehouseRequest =>
  create(CreateWarehouseRequestSchema, {
    address: 'Тестовая улица, 1',
    boardNodeId: otherUuid,
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD],
    cityId: validUuid,
    idempotencyKey: validUuid,
    name: 'Склад Северный',
    timeZone: 'Europe/Moscow',
    ...overrides,
  });

describe('GetOrganizationRequest', () => {
  it('accepts an organization id in UUID format', () => {
    const request = create(GetOrganizationRequestSchema, { organizationId: validUuid });

    expect(collectViolations(GetOrganizationRequestSchema, request)).toEqual([]);
  });

  it('rejects an organization id that is not a UUID', () => {
    const request = create(GetOrganizationRequestSchema, { organizationId: 'org-1' });

    expect(collectViolations(GetOrganizationRequestSchema, request)).toEqual([
      { fieldPath: 'organization_id', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects an empty organization id with the dedicated rule', () => {
    const request = create(GetOrganizationRequestSchema);

    expect(collectViolations(GetOrganizationRequestSchema, request)).toEqual([
      { fieldPath: 'organization_id', ruleId: 'string.uuid_empty' },
    ]);
  });
});

describe('CreateWarehouseRequest', () => {
  it('accepts a complete request', () => {
    expect(collectViolations(CreateWarehouseRequestSchema, createWarehouseRequest())).toEqual([]);
  });

  it('accepts a request without capabilities and address', () => {
    const request = createWarehouseRequest({ address: '', capabilities: [] });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([]);
  });

  it('rejects an idempotency key that is not a UUID', () => {
    const request = createWarehouseRequest({ idempotencyKey: 'key-1' });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'idempotency_key', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects an empty idempotency key with the dedicated rule', () => {
    const request = createWarehouseRequest({ idempotencyKey: '' });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'idempotency_key', ruleId: 'string.uuid_empty' },
    ]);
  });

  it('rejects an empty name', () => {
    const request = createWarehouseRequest({ name: '' });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'name', ruleId: 'string.min_len' },
    ]);
  });

  it('accepts a name of 120 characters', () => {
    const request = createWarehouseRequest({ name: 'a'.repeat(120) });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([]);
  });

  it('rejects a name of 121 characters', () => {
    const request = createWarehouseRequest({ name: 'a'.repeat(121) });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'name', ruleId: 'string.max_len' },
    ]);
  });

  it('rejects a city id that is not a UUID', () => {
    const request = createWarehouseRequest({ cityId: 'city-1' });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'city_id', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects a board node id that is not a UUID', () => {
    const request = createWarehouseRequest({ boardNodeId: 'node-1' });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'board_node_id', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects an empty board node id with the dedicated rule', () => {
    const request = createWarehouseRequest({ boardNodeId: '' });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'board_node_id', ruleId: 'string.uuid_empty' },
    ]);
  });

  it.each(['Europe/Moscow', 'Asia/Yekaterinburg', 'America/Argentina/Buenos_Aires'])(
    'accepts time zone %s',
    (timeZone) => {
      const request = createWarehouseRequest({ timeZone });

      expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([]);
    },
  );

  it.each(['Moscow', 'UTC+3', ''])('rejects time zone "%s"', (timeZone) => {
    const request = createWarehouseRequest({ timeZone });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'time_zone', ruleId: 'string.pattern' },
    ]);
  });

  it('accepts an address of 500 characters', () => {
    const request = createWarehouseRequest({ address: 'a'.repeat(500) });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([]);
  });

  it('rejects an address of 501 characters', () => {
    const request = createWarehouseRequest({ address: 'a'.repeat(501) });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'address', ruleId: 'string.max_len' },
    ]);
  });

  it('rejects repeated capabilities', () => {
    const request = createWarehouseRequest({
      capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD, WarehouseCapability.RAMP],
    });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'capabilities', ruleId: 'repeated.unique' },
    ]);
  });

  it('rejects the unspecified capability with the index of the element', () => {
    const request = createWarehouseRequest({
      capabilities: [WarehouseCapability.RAMP, WarehouseCapability.UNSPECIFIED],
    });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'capabilities[1]', ruleId: 'enum.not_in' },
    ]);
  });

  it('rejects a capability outside the enum with the index of the element', () => {
    const request = fromJson(CreateWarehouseRequestSchema, {
      address: 'Тестовая улица, 1',
      boardNodeId: otherUuid,
      capabilities: [WarehouseCapability.OVERSIZE, WarehouseCapability.COLD, 99],
      cityId: validUuid,
      idempotencyKey: validUuid,
      name: 'Склад Северный',
      timeZone: 'Europe/Moscow',
    });

    expect(collectViolations(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'capabilities[2]', ruleId: 'enum.defined_only' },
    ]);
  });
});

describe('List requests of the organization module', () => {
  it.each([
    ['ListSpheresRequest', ListSpheresRequestSchema],
    ['ListWarehousesRequest', ListWarehousesRequestSchema],
  ] as const)('accepts %s with page size 200', (_name, schema) => {
    const request = create(schema, { page: create(PageRequestSchema, { pageSize: 200 }) });

    expect(collectViolations(schema, request)).toEqual([]);
  });

  it.each([
    ['ListSpheresRequest', ListSpheresRequestSchema],
    ['ListWarehousesRequest', ListWarehousesRequestSchema],
  ] as const)('rejects %s with page size 201', (_name, schema) => {
    const request = create(schema, { page: create(PageRequestSchema, { pageSize: 201 }) });

    expect(collectViolations(schema, request)).toEqual([
      { fieldPath: 'page.page_size', ruleId: 'int32.gte_lte' },
    ]);
  });
});
