import type { FileRegistry } from '@bufbuild/protobuf';
import type {
  EnumValueDescriptorProto,
  EnumValueOptions,
} from '@bufbuild/protobuf/wkt';

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
  permission_traits as permissionTraits,
  PermissionTraitsSchema,
} from '../gen/access/v1/permission_pb';
import {
  ErrorCategory,
  error_traits as errorTraits,
  ErrorTraitsSchema,
} from '../gen/common/v1/error_pb';
import {
  MemberRequirementSchema,
  type MethodAccess,
  MethodAccessSchema,
  PermissionRequirementSchema,
  SessionRequirementSchema,
} from '../gen/common/v1/method_options_pb';
import { ProfileKind } from '../gen/organization/v1/organization_pb';
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
  createRequiredMessageField,
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
    access: createPermissionAccess('warehouse_view', 'warehouse_id'),
    name: 'ListThings',
    requestFields: [
      createMessageField('page', 1, 'common.v1.PageRequest'),
      createScalarField('warehouse_id', 2),
    ],
    responseFields: [createMessageField('page', 1, 'common.v1.PageResponse')],
    ...overrides,
  });

const createCommand = (overrides: Partial<SyntheticMethodValue> = {}): SyntheticMethodValue => ({
  access: createPermissionAccess('deal_approve', '', 'amount'),
  idempotency: MethodOptions_IdempotencyLevel.IDEMPOTENCY_UNKNOWN,
  name: 'CreateThing',
  requestFields: [
    createUuidField('idempotency_key', 1),
    createRequiredMessageField('amount', 2, 'common.v1.Money'),
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
      violationOf('GetThing', ContractRule.PERMISSION_NOT_IN_CATALOG),
    ]);
  });

  it('reports a permission name without the feature part', () => {
    const access = createPermissionAccess('view');

    expect(findViolationsOf([createQuery({ access })])).toEqual([
      violationOf('GetThing', ContractRule.ACCESS_INVALID),
      violationOf('GetThing', ContractRule.PERMISSION_NOT_IN_CATALOG),
    ]);
  });
});

describe('scope and limit rules', () => {
  it('reports a scope field that is absent from the request', () => {
    const access = createPermissionAccess('warehouse_view', 'warehouse_id');

    expect(findViolationsOf([createQuery({ access })])).toEqual([
      violationOf('GetThing', ContractRule.SCOPE_FIELD_INVALID),
    ]);
  });

  it('reports a scope field that is not a string', () => {
    const access = createPermissionAccess('warehouse_view', 'warehouse_id');
    const requestFields = [createScalarField('warehouse_id', 1, FieldDescriptorProto_Type.INT32)];

    expect(findViolationsOf([createQuery({ access, requestFields })])).toEqual([
      violationOf('GetThing', ContractRule.SCOPE_FIELD_INVALID),
    ]);
  });

  it('reports a limit field that is absent from the request', () => {
    const requestFields = [createUuidField('idempotency_key', 1)];

    expect(findViolationsOf([createCommand({ requestFields })])).toEqual([
      violationOf('CreateThing', ContractRule.LIMIT_FIELD_INVALID),
    ]);
  });

  it('reports a limit field that is not money', () => {
    const requestFields = [
      createUuidField('idempotency_key', 1),
      createScalarField('amount', 2, FieldDescriptorProto_Type.INT64),
    ];

    expect(findViolationsOf([createCommand({ requestFields })])).toEqual([
      violationOf('CreateThing', ContractRule.LIMIT_FIELD_INVALID),
    ]);
  });

  it('reports a limit field that is a message other than money', () => {
    const requestFields = [
      createUuidField('idempotency_key', 1),
      createMessageField('amount', 2, 'common.v1.PageRequest'),
    ];

    expect(findViolationsOf([createCommand({ requestFields })])).toEqual([
      violationOf('CreateThing', ContractRule.LIMIT_FIELD_INVALID),
    ]);
  });

  it('reports a limit field on a query', () => {
    const access = createPermissionAccess('deal_approve', '', 'amount');
    const requestFields = [createRequiredMessageField('amount', 1, 'common.v1.Money')];

    expect(findViolationsOf([createQuery({ access, requestFields })])).toEqual([
      violationOf('GetThing', ContractRule.LIMIT_FIELD_ON_QUERY),
    ]);
  });
});

describe('catalog rules for methods', () => {
  it('reports a command that requires only a session', () => {
    expect(findViolationsOf([createCommand({ access: createSessionAccess() })])).toEqual([
      violationOf('CreateThing', ContractRule.COMMAND_PERMISSION_MISSING),
    ]);
  });

  it('reports a command that requires only a membership', () => {
    expect(findViolationsOf([createCommand({ access: createMemberAccess() })])).toEqual([
      violationOf('CreateThing', ContractRule.COMMAND_PERMISSION_MISSING),
    ]);
  });

  it('reports a permission that is absent from the catalog', () => {
    const access = createPermissionAccess('thing_view');

    expect(findViolationsOf([createQuery({ access })])).toEqual([
      violationOf('GetThing', ContractRule.PERMISSION_NOT_IN_CATALOG),
    ]);
  });

  it('reports a scope field on a permission without a scope', () => {
    const access = createPermissionAccess('deal_view', 'warehouse_id');
    const requestFields = [createScalarField('warehouse_id', 1)];

    expect(findViolationsOf([createQuery({ access, requestFields })])).toEqual([
      violationOf('GetThing', ContractRule.SCOPE_NOT_APPLICABLE),
    ]);
  });

  it('reports a limit field on a permission without a limit', () => {
    const access = createPermissionAccess('warehouse_view', '', 'amount');

    expect(findViolationsOf([createCommand({ access })])).toEqual([
      violationOf('CreateThing', ContractRule.LIMIT_NOT_APPLICABLE),
    ]);
  });

  it('reports a limit field that the request does not require', () => {
    const requestFields = [
      createUuidField('idempotency_key', 1),
      createMessageField('amount', 2, 'common.v1.Money'),
    ];

    expect(findViolationsOf([createCommand({ requestFields })])).toEqual([
      violationOf('CreateThing', ContractRule.LIMIT_FIELD_NOT_REQUIRED),
    ]);
  });

  it('accepts a scope field on a permission with a scope', () => {
    expect(findViolationsOf([createListQuery()])).toEqual([]);
  });
});

describe('idempotency rules', () => {
  it('reports a command without the idempotency key', () => {
    const command = createCommand({
      requestFields: [
        createRequiredMessageField('amount', 2, 'common.v1.Money'),
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
        createRequiredMessageField('amount', 2, 'common.v1.Money'),
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
        createRequiredMessageField('amount', 2, 'common.v1.Money'),
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
      access: createPermissionAccess('deal_view'),
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
      access: createPermissionAccess('deal_approve'),
      idempotency: MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS,
      requestFields: [],
    });

    expect(findViolationsOf([command])).toEqual([
      violationOf('CreateThing', ContractRule.COMMAND_DECLARED_AS_QUERY),
    ]);
  });

  it('reports a command declared side-effect free with the idempotency key', () => {
    const command = createCommand({
      access: createPermissionAccess('deal_approve'),
      idempotency: MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS,
      requestFields: [createUuidField('idempotency_key', 1)],
    });

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

describe('permission catalog rules', () => {
  const PERMISSION_FILE_NAME = 'access/v1/permission.proto';
  const DEAL_VIEW_ELEMENT = 'access.v1.PermissionCode.PERMISSION_CODE_DEAL_VIEW';

  const modifyDealView = (modify: (value: EnumValueDescriptorProto) => void): FileRegistry =>
    createRegistryWithModifiedFile(PERMISSION_FILE_NAME, (file) => {
      const dealView = file.enumType
        .flatMap(enumType => enumType.value)
        .find(value => value.name === 'PERMISSION_CODE_DEAL_VIEW');

      if (dealView) {
        modify(dealView);
      }
    });

  const createTraitsOptions = (profiles: ProfileKind[]): EnumValueOptions => {
    const options = create(EnumValueOptionsSchema);

    setExtension(options, permissionTraits, create(PermissionTraitsSchema, { profiles }));

    return options;
  };

  it('reports a code without traits', () => {
    const registry = modifyDealView((value) => {
      value.options = undefined;
    });

    expect(findContractViolations(registry)).toEqual([
      { element: DEAL_VIEW_ELEMENT, rule: ContractRule.PERMISSION_TRAITS_MISSING },
    ]);
  });

  it('reports a code whose traits have no profiles', () => {
    const registry = modifyDealView((value) => {
      value.options = createTraitsOptions([]);
    });

    expect(findContractViolations(registry)).toEqual([
      { element: DEAL_VIEW_ELEMENT, rule: ContractRule.PERMISSION_TRAITS_MISSING },
    ]);
  });

  it('reports a code whose traits have an unspecified profile', () => {
    const registry = modifyDealView((value) => {
      value.options = createTraitsOptions([ProfileKind.CUSTOMER, ProfileKind.UNSPECIFIED]);
    });

    expect(findContractViolations(registry)).toEqual([
      { element: DEAL_VIEW_ELEMENT, rule: ContractRule.PERMISSION_TRAITS_MISSING },
    ]);
  });

  it.each([
    ['PERMISSION_CODE_DEAL_PUBLISH', 'a name with an unknown action'],
    ['PERMISSION_CODE_VIEW', 'a name without a feature'],
    ['PERMISSION_CODE_2DEAL_VIEW', 'a feature that starts with a digit'],
  ])('reports %s: %s', (name) => {
    const registry = modifyDealView((value) => {
      value.name = name;
    });

    expect(findContractViolations(registry)).toEqual([
      { element: `access.v1.PermissionCode.${name}`, rule: ContractRule.PERMISSION_CODE_INVALID },
    ]);
  });
});
