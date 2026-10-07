import {
  create,
  setExtension,
} from '@bufbuild/protobuf';
import {
  EnumValueOptionsSchema,
  FieldDescriptorProto_Type,
  MethodOptions_IdempotencyLevel,
} from '@bufbuild/protobuf/wkt';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MemberRequirementSchema,
  type MethodAccess,
  MethodAccessSchema,
  PermissionRequirementSchema,
  SessionRequirementSchema,
} from '../gen/common/v1/access_pb';
import {
  ErrorCategory,
  error_traits as errorTraits,
  ErrorTraitsSchema,
} from '../gen/common/v1/error_pb';
import {
  ContractRule,
  type ContractViolationValue,
} from './contractRule';
import { findContractViolations } from './findContractViolations';
import { loadContractRegistry } from './loadContractRegistry';
import {
  contractImagePath,
  createMessageField,
  createRegistryWithModifiedFile,
  createScalarField,
  createSyntheticRegistry,
  createUuidField,
  type SyntheticMethodValue,
} from './syntheticContract';

const PACKAGE_NAME = 'probe.v1';
const SERVICE_NAME = `${PACKAGE_NAME}.ProbeService`;

const createSessionAccess = (): MethodAccess =>
  create(MethodAccessSchema, {
    requirement: { case: 'session', value: create(SessionRequirementSchema) },
  });

const createMemberAccess = (): MethodAccess =>
  create(MethodAccessSchema, {
    requirement: { case: 'member', value: create(MemberRequirementSchema) },
  });

const createPermissionAccess = (name: string, scopeField = '', limitField = ''): MethodAccess =>
  create(MethodAccessSchema, {
    requirement: {
      case: 'permission',
      value: create(PermissionRequirementSchema, {
        limitField,
        name,
        scopeField,
      }),
    },
  });

const createQuery = (overrides: Partial<SyntheticMethodValue> = {}): SyntheticMethodValue => ({
  access: createSessionAccess(),
  idempotency: MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS,
  name: 'GetThing',
  requestFields: [],
  responseFields: [],
  ...overrides,
});

const createListQuery = (overrides: Partial<SyntheticMethodValue> = {}): SyntheticMethodValue =>
  createQuery({
    access: createPermissionAccess('thing_view', 'warehouse_id'),
    name: 'ListThings',
    requestFields: [
      createMessageField('page', 1, 'common.v1.PageRequest'),
      createScalarField('warehouse_id', 2),
    ],
    responseFields: [createMessageField('page', 1, 'common.v1.PageResponse')],
    ...overrides,
  });

const createCommand = (overrides: Partial<SyntheticMethodValue> = {}): SyntheticMethodValue => ({
  access: createPermissionAccess('thing_create', 'warehouse_id', 'amount'),
  idempotency: MethodOptions_IdempotencyLevel.IDEMPOTENCY_UNKNOWN,
  name: 'CreateThing',
  requestFields: [
    createUuidField('idempotency_key', 1),
    createScalarField('warehouse_id', 2),
    createMessageField('amount', 3, 'common.v1.Money'),
  ],
  responseFields: [],
  ...overrides,
});

const findViolationsOf = (methods: SyntheticMethodValue[], packageName = PACKAGE_NAME): ContractViolationValue[] =>
  findContractViolations(createSyntheticRegistry({ methods, packageName }));

const violationOf = (method: string, rule: ContractRule): ContractViolationValue => ({
  element: `${SERVICE_NAME}.${method}`,
  rule,
});

describe('findContractViolations on the contract image', () => {
  it('finds no violations', () => {
    expect(findContractViolations(loadContractRegistry(contractImagePath))).toEqual([]);
  });
});

describe('findContractViolations on a conforming synthetic service', () => {
  it('finds no violations', () => {
    const methods = [
      createQuery(),
      createQuery({ access: createMemberAccess(), name: 'GetOtherThing' }),
      createListQuery(),
      createCommand(),
    ];

    expect(findViolationsOf(methods)).toEqual([]);
  });
});

describe('access rules', () => {
  it('reports a method without the access option', () => {
    expect(findViolationsOf([createQuery({ access: undefined })])).toEqual([
      violationOf('GetThing', ContractRule.ACCESS_MISSING),
    ]);
  });

  it('reports an access option that fails validation', () => {
    const emptyAccess = create(MethodAccessSchema);

    expect(findViolationsOf([createQuery({ access: emptyAccess })])).toEqual([
      violationOf('GetThing', ContractRule.ACCESS_INVALID),
    ]);
  });

  it('reports a permission name that fails validation together with its unknown action', () => {
    const access = createPermissionAccess('thing_approved');

    expect(findViolationsOf([createQuery({ access })])).toEqual([
      violationOf('GetThing', ContractRule.ACCESS_INVALID),
      violationOf('GetThing', ContractRule.PERMISSION_ACTION_UNKNOWN),
    ]);
  });

  it('reports a permission name without the feature part', () => {
    const access = createPermissionAccess('view');

    expect(findViolationsOf([createQuery({ access })])).toEqual([
      violationOf('GetThing', ContractRule.ACCESS_INVALID),
    ]);
  });
});

describe('scope and limit rules', () => {
  it('reports a scope field that is absent from the request', () => {
    const access = createPermissionAccess('thing_view', 'warehouse_id');

    expect(findViolationsOf([createQuery({ access })])).toEqual([
      violationOf('GetThing', ContractRule.SCOPE_FIELD_INVALID),
    ]);
  });

  it('reports a scope field that is not a string', () => {
    const access = createPermissionAccess('thing_view', 'warehouse_id');
    const requestFields = [createScalarField('warehouse_id', 1, FieldDescriptorProto_Type.INT32)];

    expect(findViolationsOf([createQuery({ access, requestFields })])).toEqual([
      violationOf('GetThing', ContractRule.SCOPE_FIELD_INVALID),
    ]);
  });

  it('reports a limit field that is absent from the request', () => {
    const access = createPermissionAccess('thing_view', '', 'amount');

    expect(findViolationsOf([createQuery({ access })])).toEqual([
      violationOf('GetThing', ContractRule.LIMIT_FIELD_INVALID),
    ]);
  });

  it('reports a limit field that is not money', () => {
    const access = createPermissionAccess('thing_view', '', 'amount');
    const requestFields = [createScalarField('amount', 1, FieldDescriptorProto_Type.INT64)];

    expect(findViolationsOf([createQuery({ access, requestFields })])).toEqual([
      violationOf('GetThing', ContractRule.LIMIT_FIELD_INVALID),
    ]);
  });

  it('reports a limit field that is a message other than money', () => {
    const access = createPermissionAccess('thing_view', '', 'amount');
    const requestFields = [createMessageField('amount', 1, 'common.v1.PageRequest')];

    expect(findViolationsOf([createQuery({ access, requestFields })])).toEqual([
      violationOf('GetThing', ContractRule.LIMIT_FIELD_INVALID),
    ]);
  });
});

describe('idempotency rules', () => {
  it('reports a command without the idempotency key', () => {
    const command = createCommand({
      requestFields: [
        createScalarField('warehouse_id', 2),
        createMessageField('amount', 3, 'common.v1.Money'),
      ],
    });

    expect(findViolationsOf([command])).toEqual([
      violationOf('CreateThing', ContractRule.IDEMPOTENCY_KEY_MISSING),
    ]);
  });

  it('reports a command whose idempotency key has no uuid rule', () => {
    const command = createCommand({
      requestFields: [
        createScalarField('idempotency_key', 1),
        createScalarField('warehouse_id', 2),
        createMessageField('amount', 3, 'common.v1.Money'),
      ],
    });

    expect(findViolationsOf([command])).toEqual([
      violationOf('CreateThing', ContractRule.IDEMPOTENCY_KEY_MISSING),
    ]);
  });

  it('reports a command whose idempotency key is not a string', () => {
    const command = createCommand({
      requestFields: [
        createScalarField('idempotency_key', 1, FieldDescriptorProto_Type.BYTES),
        createScalarField('warehouse_id', 2),
        createMessageField('amount', 3, 'common.v1.Money'),
      ],
    });

    expect(findViolationsOf([command])).toEqual([
      violationOf('CreateThing', ContractRule.IDEMPOTENCY_KEY_MISSING),
    ]);
  });

  it('reports a query that carries an idempotency key', () => {
    const query = createQuery({ requestFields: [createUuidField('idempotency_key', 1)] });

    expect(findViolationsOf([query])).toEqual([
      violationOf('GetThing', ContractRule.IDEMPOTENCY_KEY_UNEXPECTED),
    ]);
  });

  it('reports a Get method that is not side-effect free', () => {
    const query = createQuery({
      idempotency: MethodOptions_IdempotencyLevel.IDEMPOTENT,
      requestFields: [createUuidField('idempotency_key', 1)],
    });

    expect(findViolationsOf([query])).toEqual([
      violationOf('GetThing', ContractRule.QUERY_HAS_SIDE_EFFECTS),
    ]);
  });

  it('reports a List method that is not side-effect free', () => {
    const query = createListQuery({
      idempotency: MethodOptions_IdempotencyLevel.IDEMPOTENCY_UNKNOWN,
      requestFields: [
        createMessageField('page', 1, 'common.v1.PageRequest'),
        createScalarField('warehouse_id', 2),
        createUuidField('idempotency_key', 3),
      ],
    });

    expect(findViolationsOf([query])).toEqual([
      violationOf('ListThings', ContractRule.QUERY_HAS_SIDE_EFFECTS),
    ]);
  });

  it('reports a command declared side-effect free without the idempotency key', () => {
    const command = createCommand({
      idempotency: MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS,
      requestFields: [
        createScalarField('warehouse_id', 2),
        createMessageField('amount', 3, 'common.v1.Money'),
      ],
    });

    expect(findViolationsOf([command])).toEqual([
      violationOf('CreateThing', ContractRule.COMMAND_DECLARED_AS_QUERY),
    ]);
  });

  it('reports a command declared side-effect free with the idempotency key', () => {
    const command = createCommand({ idempotency: MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS });

    expect(findViolationsOf([command])).toEqual([
      violationOf('CreateThing', ContractRule.COMMAND_DECLARED_AS_QUERY),
    ]);
  });
});

describe('pagination rule', () => {
  it('reports a List request without a page', () => {
    const query = createListQuery({ requestFields: [createScalarField('warehouse_id', 2)] });

    expect(findViolationsOf([query])).toEqual([
      violationOf('ListThings', ContractRule.PAGINATION_MISSING),
    ]);
  });

  it('reports a List response without a page', () => {
    const query = createListQuery({ responseFields: [] });

    expect(findViolationsOf([query])).toEqual([
      violationOf('ListThings', ContractRule.PAGINATION_MISSING),
    ]);
  });

  it('reports a List request page of the wrong type', () => {
    const query = createListQuery({
      requestFields: [
        createMessageField('page', 1, 'common.v1.PageResponse'),
        createScalarField('warehouse_id', 2),
      ],
    });

    expect(findViolationsOf([query])).toEqual([
      violationOf('ListThings', ContractRule.PAGINATION_MISSING),
    ]);
  });

  it('reports a List response page of the wrong type', () => {
    const query = createListQuery({ responseFields: [createMessageField('page', 1, 'common.v1.PageRequest')] });

    expect(findViolationsOf([query])).toEqual([
      violationOf('ListThings', ContractRule.PAGINATION_MISSING),
    ]);
  });
});

describe('package name rule', () => {
  it.each([
    'probe',
    'probe.v',
    'Probe.v1',
    'probe.v1.extra',
    'skladburg.v1',
    'tridok.v1',
    'tridock.v1',
    'my_skladburg.v1',
  ])('reports package "%s"', (packageName) => {
    expect(findViolationsOf([createQuery()], packageName)).toEqual([
      { element: 'probe/v1/probe.proto', rule: ContractRule.PACKAGE_NAME_INVALID },
    ]);
  });

  it.each(['probe.v1', 'probe_two.v2', 'probe9.v10'])('accepts package "%s"', (packageName) => {
    expect(findViolationsOf([createQuery()], packageName)).toEqual([]);
  });
});

describe('error rules', () => {
  const ERROR_FILE_NAME = 'common/v1/error.proto';

  it('reports an error code without error traits', () => {
    const registry = createRegistryWithModifiedFile(ERROR_FILE_NAME, (file) => {
      const notFound = file.enumType.flatMap(enumType => enumType.value).find(value => value.name === 'ERROR_CODE_NOT_FOUND');

      if (notFound) {
        notFound.options = undefined;
      }
    });

    expect(findContractViolations(registry)).toEqual([
      { element: 'common.v1.ErrorCode.ERROR_CODE_NOT_FOUND', rule: ContractRule.ERROR_TRAITS_MISSING },
    ]);
  });

  it('reports an error code whose traits have an unspecified category', () => {
    const registry = createRegistryWithModifiedFile(ERROR_FILE_NAME, (file) => {
      const internal = file.enumType.flatMap(enumType => enumType.value).find(value => value.name === 'ERROR_CODE_INTERNAL');
      const options = create(EnumValueOptionsSchema);

      setExtension(options, errorTraits, create(ErrorTraitsSchema, { category: ErrorCategory.UNSPECIFIED, isRetryable: true }));

      if (internal) {
        internal.options = options;
      }
    });

    expect(findContractViolations(registry)).toEqual([
      { element: 'common.v1.ErrorCode.ERROR_CODE_INTERNAL', rule: ContractRule.ERROR_TRAITS_MISSING },
    ]);
  });

  it('reports a params branch that names no error code', () => {
    const registry = createRegistryWithModifiedFile(ERROR_FILE_NAME, (file) => {
      const branch = file.messageType
        .flatMap(message => message.field)
        .find(field => field.name === 'permission_denied');

      if (branch) {
        branch.name = 'permission_forbidden';
      }
    });

    expect(findContractViolations(registry)).toEqual([
      { element: 'common.v1.ErrorDetail.permission_forbidden', rule: ContractRule.ERROR_PARAMS_ORPHAN },
    ]);
  });

  it('reports a params branch that names the unspecified code', () => {
    const registry = createRegistryWithModifiedFile(ERROR_FILE_NAME, (file) => {
      const branch = file.messageType
        .flatMap(message => message.field)
        .find(field => field.name === 'not_found');

      if (branch) {
        branch.name = 'unspecified';
      }
    });

    expect(findContractViolations(registry)).toEqual([
      { element: 'common.v1.ErrorDetail.unspecified', rule: ContractRule.ERROR_PARAMS_ORPHAN },
    ]);
  });

  it('reports a params branch whose message does not match the code', () => {
    const registry = createRegistryWithModifiedFile(ERROR_FILE_NAME, (file) => {
      const branch = file.messageType
        .flatMap(message => message.field)
        .find(field => field.name === 'limit_exceeded');

      if (branch) {
        branch.typeName = '.common.v1.NotFoundParams';
      }
    });

    expect(findContractViolations(registry)).toEqual([
      { element: 'common.v1.ErrorDetail.limit_exceeded', rule: ContractRule.ERROR_PARAMS_ORPHAN },
    ]);
  });
});
