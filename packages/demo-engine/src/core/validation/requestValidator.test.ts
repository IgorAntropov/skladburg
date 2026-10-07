import {
  create,
  fromJson,
  type MessageShape,
} from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { PageRequestSchema } from '@skladburg/contracts/common/v1/page';
import {
  CreateWarehouseRequestSchema,
  GetOrganizationRequestSchema,
  ListWarehousesRequestSchema,
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
  createRequestValidator,
  type IRequestValidator,
} from './requestValidator';

const UUID = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_UUID = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const createValidatorForTest = (): IRequestValidator => createRequestValidator(createDomainErrors(createSeededRandom(1)));

const createWarehouseRequest = (
  overrides: Partial<MessageShape<typeof CreateWarehouseRequestSchema>> = {},
): MessageShape<typeof CreateWarehouseRequestSchema> => create(CreateWarehouseRequestSchema, {
  address: 'Адрес 1',
  boardNodeId: OTHER_UUID,
  capabilities: [WarehouseCapability.RAMP],
  cityId: UUID,
  idempotencyKey: UUID,
  name: 'Склад 1',
  timeZone: 'Europe/Moscow',
  ...overrides,
});

const captureError = (action: () => void): unknown => {
  try {
    action();
  }
  catch (error) {
    return error;
  }

  return undefined;
};

describe('createRequestValidator.collect', () => {
  it('returns no violations for a valid request', () => {
    expect(createValidatorForTest().collect(CreateWarehouseRequestSchema, createWarehouseRequest())).toEqual([]);
  });

  it('reports all violations of an empty CreateWarehouseRequest with protovalidate rule ids', () => {
    const violations = createValidatorForTest().collect(CreateWarehouseRequestSchema, create(CreateWarehouseRequestSchema));

    expect(violations).toEqual([
      { fieldPath: 'idempotency_key', ruleId: 'string.uuid_empty' },
      { fieldPath: 'name', ruleId: 'string.min_len' },
      { fieldPath: 'city_id', ruleId: 'string.uuid_empty' },
      { fieldPath: 'board_node_id', ruleId: 'string.uuid_empty' },
      { fieldPath: 'time_zone', ruleId: 'string.pattern' },
    ]);
  });

  it('reports crooked fields with their paths', () => {
    const request = createWarehouseRequest({
      cityId: 'city-1',
      name: 'a'.repeat(121),
      timeZone: 'Moscow',
    });

    expect(createValidatorForTest().collect(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'name', ruleId: 'string.max_len' },
      { fieldPath: 'city_id', ruleId: 'string.uuid' },
      { fieldPath: 'time_zone', ruleId: 'string.pattern' },
    ]);
  });

  it('indexes the element of a repeated field', () => {
    const request = fromJson(CreateWarehouseRequestSchema, {
      address: '',
      boardNodeId: OTHER_UUID,
      capabilities: [WarehouseCapability.RAMP, 99],
      cityId: UUID,
      idempotencyKey: UUID,
      name: 'Склад 1',
      timeZone: 'Europe/Moscow',
    });

    expect(createValidatorForTest().collect(CreateWarehouseRequestSchema, request)).toEqual([
      { fieldPath: 'capabilities[1]', ruleId: 'enum.defined_only' },
    ]);
  });

  it('reports a nested path with the number rule id', () => {
    const request = create(ListWarehousesRequestSchema, { page: create(PageRequestSchema, { pageSize: 201 }) });

    expect(createValidatorForTest().collect(ListWarehousesRequestSchema, request)).toEqual([
      { fieldPath: 'page.page_size', ruleId: 'int32.gte_lte' },
    ]);
  });
});

describe('createRequestValidator.validate', () => {
  it('passes a valid request', () => {
    expect(() => {
      createValidatorForTest().validate(GetOrganizationRequestSchema, create(GetOrganizationRequestSchema, { organizationId: UUID }));
    }).not.toThrow();
  });

  it('throws validation_failed with invalid_argument and the violations in the detail', () => {
    const request = createWarehouseRequest({ name: '', timeZone: 'UTC+3' });
    const error = captureError(() => {
      createValidatorForTest().validate(CreateWarehouseRequestSchema, request);
    });
    const details = ConnectError.from(error).findDetails(ErrorDetailSchema)[0];

    expect(ConnectError.from(error).code).toBe(Code.InvalidArgument);
    expect(details?.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(details?.params.case).toBe('validationFailed');
    expect(details?.params.value).toMatchObject({
      violations: [
        { fieldPath: 'name', ruleId: 'string.min_len' },
        { fieldPath: 'time_zone', ruleId: 'string.pattern' },
      ],
    });
  });

  it('reuses one validator for many requests', () => {
    const validator = createValidatorForTest();

    expect(() => {
      validator.validate(CreateWarehouseRequestSchema, createWarehouseRequest());
      validator.validate(CreateWarehouseRequestSchema, createWarehouseRequest({ name: 'Склад 2' }));
    }).not.toThrow();
  });
});
