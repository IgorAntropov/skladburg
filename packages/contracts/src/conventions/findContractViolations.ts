import type {
  DescEnum,
  DescField,
  DescFile,
  DescMessage,
  DescMethod,
  FileRegistry,
} from '@bufbuild/protobuf';

import {
  getOption,
  hasOption,
  ScalarType,
} from '@bufbuild/protobuf';
import { MethodOptions_IdempotencyLevel } from '@bufbuild/protobuf/wkt';
import { field as fieldRules } from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';

import {
  ErrorCategory,
  error_traits as errorTraits,
} from '../gen/common/v1/error_pb';
import {
  access,
  MethodAccessSchema,
} from '../gen/common/v1/method_options_pb';
import { collectViolations } from '../validation/collectViolations';
import {
  ContractRule,
  type ContractViolationValue,
} from './contractRule';
import { listPermissionActions } from './permissionActions';

const EXTERNAL_PACKAGES: readonly string[] = ['buf.validate', 'google.protobuf'];
const FORBIDDEN_PACKAGE_WORDS: readonly string[] = ['skladburg', 'tridock', 'tridok'];
const PACKAGE_NAME_PATTERN = /^[a-z][a-z0-9_]*\.v[0-9]+$/;
const QUERY_PREFIXES: readonly string[] = ['Get', 'List'];
const MONEY_TYPE_NAME = 'common.v1.Money';
const PAGE_REQUEST_TYPE_NAME = 'common.v1.PageRequest';
const PAGE_RESPONSE_TYPE_NAME = 'common.v1.PageResponse';
const ERROR_CODE_TYPE_NAME = 'common.v1.ErrorCode';
const ERROR_DETAIL_TYPE_NAME = 'common.v1.ErrorDetail';
const ERROR_PARAMS_ONEOF_NAME = 'params';
const IDEMPOTENCY_KEY_FIELD_NAME = 'idempotency_key';
const PAGE_FIELD_NAME = 'page';

const isContractFile = (file: DescFile): boolean => !EXTERNAL_PACKAGES.includes(file.proto.package);

const createViolation = (element: string, rule: ContractRule): ContractViolationValue => ({ element, rule });

const getMethodElement = (method: DescMethod): string => `${method.parent.typeName}.${method.name}`;

const findField = (message: DescMessage, name: string): DescField | undefined =>
  message.fields.find(field => field.name === name);

const isStringField = (field: DescField | undefined): boolean =>
  field?.fieldKind === 'scalar' && field.scalar === ScalarType.STRING;

const isMessageField = (field: DescField | undefined, typeName: string): boolean =>
  field?.fieldKind === 'message' && field.message.typeName === typeName;

const hasUuidRule = (field: DescField): boolean => {
  if (!hasOption(field, fieldRules)) {
    return false;
  }

  const { type } = getOption(field, fieldRules);

  return type.case === 'string' && type.value.wellKnown.case === 'uuid' && type.value.wellKnown.value;
};

const isQuery = (method: DescMethod): boolean => QUERY_PREFIXES.some(prefix => method.name.startsWith(prefix));

const isSideEffectFree = (method: DescMethod): boolean =>
  method.idempotency === MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS;

const toPascalCase = (snakeCaseName: string): string =>
  snakeCaseName
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const findPackageViolations = (file: DescFile): ContractViolationValue[] => {
  const { package: packageName } = file.proto;
  const isForbidden = FORBIDDEN_PACKAGE_WORDS.some(word => packageName.includes(word));

  return !PACKAGE_NAME_PATTERN.test(packageName) || isForbidden
    ? [createViolation(file.proto.name, ContractRule.PACKAGE_NAME_INVALID)]
    : [];
};

const findAccessViolations = (method: DescMethod): ContractViolationValue[] => {
  const element = getMethodElement(method);

  if (!hasOption(method, access)) {
    return [createViolation(element, ContractRule.ACCESS_MISSING)];
  }

  const methodAccess = getOption(method, access);
  const violations: ContractViolationValue[] = [];

  if (collectViolations(MethodAccessSchema, methodAccess).length > 0) {
    violations.push(createViolation(element, ContractRule.ACCESS_INVALID));
  }

  if (methodAccess.requirement.case !== 'permission') {
    return violations;
  }

  const { limitField, name, scopeField } = methodAccess.requirement.value;
  const action = name.slice(name.lastIndexOf('_') + 1);

  if (!listPermissionActions().includes(action)) {
    violations.push(createViolation(element, ContractRule.PERMISSION_ACTION_UNKNOWN));
  }

  if (scopeField !== '' && !isStringField(findField(method.input, scopeField))) {
    violations.push(createViolation(element, ContractRule.SCOPE_FIELD_INVALID));
  }

  if (limitField !== '' && !isMessageField(findField(method.input, limitField), MONEY_TYPE_NAME)) {
    violations.push(createViolation(element, ContractRule.LIMIT_FIELD_INVALID));
  }

  return violations;
};

const findIdempotencyViolations = (method: DescMethod): ContractViolationValue[] => {
  const element = getMethodElement(method);
  const key = findField(method.input, IDEMPOTENCY_KEY_FIELD_NAME);
  const violations: ContractViolationValue[] = [];

  if (isQuery(method) && !isSideEffectFree(method)) {
    violations.push(createViolation(element, ContractRule.QUERY_HAS_SIDE_EFFECTS));
  }

  if (!isQuery(method) && isSideEffectFree(method)) {
    violations.push(createViolation(element, ContractRule.COMMAND_DECLARED_AS_QUERY));
  }

  if (isQuery(method) && isSideEffectFree(method) && key) {
    violations.push(createViolation(element, ContractRule.IDEMPOTENCY_KEY_UNEXPECTED));
  }

  if (!isSideEffectFree(method) && (!key || !isStringField(key) || !hasUuidRule(key))) {
    violations.push(createViolation(element, ContractRule.IDEMPOTENCY_KEY_MISSING));
  }

  return violations;
};

const findPaginationViolations = (method: DescMethod): ContractViolationValue[] => {
  if (!method.name.startsWith('List')) {
    return [];
  }

  const isRequestPaged = isMessageField(findField(method.input, PAGE_FIELD_NAME), PAGE_REQUEST_TYPE_NAME);
  const isResponsePaged = isMessageField(findField(method.output, PAGE_FIELD_NAME), PAGE_RESPONSE_TYPE_NAME);

  return isRequestPaged && isResponsePaged
    ? []
    : [createViolation(getMethodElement(method), ContractRule.PAGINATION_MISSING)];
};

const findMethodViolations = (method: DescMethod): ContractViolationValue[] => [
  ...findAccessViolations(method),
  ...findIdempotencyViolations(method),
  ...findPaginationViolations(method),
];

const requireEnum = (registry: FileRegistry, typeName: string): DescEnum => {
  const descriptor = registry.getEnum(typeName);

  if (!descriptor) {
    throw new Error(`Contract does not declare enum ${typeName}`);
  }

  return descriptor;
};

const requireMessage = (registry: FileRegistry, typeName: string): DescMessage => {
  const descriptor = registry.getMessage(typeName);

  if (!descriptor) {
    throw new Error(`Contract does not declare message ${typeName}`);
  }

  return descriptor;
};

const findErrorTraitsViolations = (errorCode: DescEnum): ContractViolationValue[] =>
  errorCode.values
    .filter(value => value.number !== 0)
    .filter(value => !hasOption(value, errorTraits) || getOption(value, errorTraits).category === ErrorCategory.UNSPECIFIED)
    .map(value => createViolation(`${errorCode.typeName}.${value.name}`, ContractRule.ERROR_TRAITS_MISSING));

const findErrorParamsViolations = (errorCode: DescEnum, errorDetail: DescMessage): ContractViolationValue[] => {
  const expectedMessageNames = new Map(
    errorCode.values
      .filter(value => value.number !== 0)
      .map((value) => {
        const branchName = value.localName.toLowerCase();

        return [branchName, `${toPascalCase(branchName)}Params`] as const;
      }),
  );
  const paramsOneof = errorDetail.oneofs.find(oneof => oneof.name === ERROR_PARAMS_ONEOF_NAME);

  return (paramsOneof?.fields ?? [])
    .filter((branch) => {
      const expectedMessageName = expectedMessageNames.get(branch.name);

      return expectedMessageName === undefined || branch.message?.name !== expectedMessageName;
    })
    .map(branch => createViolation(`${errorDetail.typeName}.${branch.name}`, ContractRule.ERROR_PARAMS_ORPHAN));
};

const findErrorViolations = (registry: FileRegistry): ContractViolationValue[] => {
  const errorCode = requireEnum(registry, ERROR_CODE_TYPE_NAME);
  const errorDetail = requireMessage(registry, ERROR_DETAIL_TYPE_NAME);

  return [
    ...findErrorTraitsViolations(errorCode),
    ...findErrorParamsViolations(errorCode, errorDetail),
  ];
};

export const findContractViolations = (registry: FileRegistry): ContractViolationValue[] => {
  const contractFiles = [...registry.files].filter(isContractFile);

  return [
    ...contractFiles.flatMap(findPackageViolations),
    ...contractFiles.flatMap(file => file.services.flatMap(service => service.methods.flatMap(findMethodViolations))),
    ...findErrorViolations(registry),
  ];
};
