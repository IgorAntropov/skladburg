import {
  create,
  fromJson,
  type MessageShape,
} from '@bufbuild/protobuf';
import { createValidator } from '@bufbuild/protovalidate';
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
  BankAccountSchema,
  UpdateOrganizationRequisitesRequestSchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import { getContractRegistry } from '@skladburg/contracts/registry';
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

const registry = getContractRegistry();

const createValidatorForTest = (): IRequestValidator =>
  createRequestValidator(createDomainErrors(createSeededRandom(1)), registry);

const createWarehouseRequest = (
  overrides: Partial<MessageShape<typeof CreateWarehouseRequestSchema>> = {},
): MessageShape<typeof CreateWarehouseRequestSchema> => create(CreateWarehouseRequestSchema, {
  address: 'Адрес 1',
  capabilities: [WarehouseCapability.RAMP],
  cityId: UUID,
  idempotencyKey: UUID,
  mapNodeId: OTHER_UUID,
  name: 'Склад 1',
  timeZone: 'Europe/Moscow',
  ...overrides,
});

const createRequisitesRequest = (
  overrides: Partial<MessageShape<typeof BankAccountSchema>> = {},
): MessageShape<typeof UpdateOrganizationRequisitesRequestSchema> => create(UpdateOrganizationRequisitesRequestSchema, {
  bank: create(BankAccountSchema, {
    bankName: 'АО «Банк Складбург»',
    bik: '040000501',
    correspondentAccount: '30101810600000000501',
    settlementAccount: '40702810300000000001',
    ...overrides,
  }),
  expectedVersion: 1n,
  idempotencyKey: UUID,
  legalAddress: '000000, г. Москва, Чайный пер., д. 4',
  vatMode: VatMode.GENERAL,
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
      { fieldPath: 'name', ruleId: 'required' },
      { fieldPath: 'city_id', ruleId: 'string.uuid_empty' },
      { fieldPath: 'map_node_id', ruleId: 'string.uuid_empty' },
      { fieldPath: 'time_zone', ruleId: 'required' },
    ]);
  });

  it('takes the rules from the contract image and not from the description it is given', () => {
    const request = create(CreateWarehouseRequestSchema);
    const generatedViolations = createValidator().validate(CreateWarehouseRequestSchema, request);

    expect(generatedViolations.kind).toBe('valid');
    expect(createValidatorForTest().collect(CreateWarehouseRequestSchema, request).length).toBeGreaterThan(0);
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
      capabilities: [WarehouseCapability.RAMP, 99],
      cityId: UUID,
      idempotencyKey: UUID,
      mapNodeId: OTHER_UUID,
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

describe('createRequestValidator.collect field checks', () => {
  const collectRequisites = (overrides: Partial<MessageShape<typeof BankAccountSchema>> = {}): ReturnType<IRequestValidator['collect']> =>
    createValidatorForTest().collect(UpdateOrganizationRequisitesRequestSchema, createRequisitesRequest(overrides));

  it('accepts accounts with a correct key', () => {
    expect(collectRequisites()).toEqual([]);
  });

  it('adds the check violation of the nested settlement account after the violations of protovalidate', () => {
    expect(collectRequisites({ settlementAccount: '40702810400000000001' })).toEqual([
      { fieldPath: 'bank.settlement_account', ruleId: 'field_check.settlement_account' },
    ]);
  });

  it('adds the check violation of the nested correspondent account', () => {
    expect(collectRequisites({ correspondentAccount: '30101810700000000501' })).toEqual([
      { fieldPath: 'bank.correspondent_account', ruleId: 'field_check.correspondent_account' },
    ]);
  });

  it('keeps the violation of protovalidate and skips the check of the same field', () => {
    expect(collectRequisites({ settlementAccount: '4070281040000000000' })).toEqual([
      { fieldPath: 'bank.settlement_account', ruleId: 'string.pattern' },
    ]);
  });

  it('skips the accounts while the BIK is wrong', () => {
    expect(collectRequisites({ bik: '050000501', settlementAccount: '40702810400000000001' })).toEqual([
      { fieldPath: 'bank.bik', ruleId: 'string.pattern' },
    ]);
  });

  it('reports both protovalidate and check violations of different fields together', () => {
    expect(collectRequisites({ bankName: '', settlementAccount: '40702810400000000001' })).toEqual([
      { fieldPath: 'bank.bank_name', ruleId: 'required' },
      { fieldPath: 'bank.settlement_account', ruleId: 'field_check.settlement_account' },
    ]);
  });

  it('throws validation_failed with the check rule id in the detail', () => {
    const error = captureError(() => {
      createValidatorForTest().validate(
        UpdateOrganizationRequisitesRequestSchema,
        createRequisitesRequest({ settlementAccount: '40702810400000000001' }),
      );
    });
    const details = ConnectError.from(error).findDetails(ErrorDetailSchema)[0];

    expect(details?.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(details?.params.value).toMatchObject({
      violations: [{ fieldPath: 'bank.settlement_account', ruleId: 'field_check.settlement_account' }],
    });
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
        { fieldPath: 'name', ruleId: 'required' },
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
