import type {
  DescEnum,
  DescEnumValue,
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
  permission_traits as permissionTraits,
  type PermissionTraits,
} from '../gen/access/v1/permission_pb';
import {
  ErrorCategory,
  error_traits as errorTraits,
} from '../gen/common/v1/error_pb';
import {
  access,
  MethodAccessSchema,
  type PermissionRequirement,
} from '../gen/common/v1/method_options_pb';
import { ProfileKind } from '../gen/organization/v1/organization_pb';
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
const PERMISSION_CODE_TYPE_NAME = 'access.v1.PermissionCode';
const PERMISSION_CODE_PREFIX = 'PERMISSION_CODE_';
const PERMISSION_FEATURE_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const PLATFORM_PERMISSION_PREFIXES: readonly string[] = ['support_', 'platform_'];
const CLIENT_SUPPORT_PERMISSION_PREFIX = 'support_access_';
const ERROR_DETAIL_TYPE_NAME = 'common.v1.ErrorDetail';
const ERROR_PARAMS_ONEOF_NAME = 'params';
const IDEMPOTENCY_KEY_FIELD_NAME = 'idempotency_key';
const PAGE_FIELD_NAME = 'page';

type PermissionCatalogValue = ReadonlyMap<string, PermissionTraits | undefined>;

const isContractFile = (file: DescFile): boolean => !EXTERNAL_PACKAGES.includes(file.proto.package);

const createViolation = (element: string, rule: ContractRule): ContractViolationValue => ({ element, rule });

const getMethodElement = (method: DescMethod): string => `${method.parent.typeName}.${method.name}`;

const findField = (message: DescMessage, name: string): DescField | undefined =>
  message.fields.find(field => field.name === name);

const isStringField = (field: DescField | undefined): boolean =>
  field?.fieldKind === 'scalar' && field.scalar === ScalarType.STRING;

const isMessageField = (field: DescField | undefined, typeName: string): boolean =>
  field?.fieldKind === 'message' && field.message.typeName === typeName;

const isRequiredField = (field: DescField): boolean => hasOption(field, fieldRules) && getOption(field, fieldRules).required;

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

const findPermissionViolations = (
  method: DescMethod,
  requirement: PermissionRequirement,
  catalog: PermissionCatalogValue,
): ContractViolationValue[] => {
  const element = getMethodElement(method);
  const { limitField, name, scopeField } = requirement;
  const action = name.slice(name.lastIndexOf('_') + 1);
  const violations: ContractViolationValue[] = [];

  if (!listPermissionActions().includes(action)) {
    violations.push(createViolation(element, ContractRule.PERMISSION_ACTION_UNKNOWN));
  }

  const limitFieldDescriptor = findField(method.input, limitField);

  if (scopeField !== '' && !isStringField(findField(method.input, scopeField))) {
    violations.push(createViolation(element, ContractRule.SCOPE_FIELD_INVALID));
  }

  if (limitField !== '' && !isMessageField(limitFieldDescriptor, MONEY_TYPE_NAME)) {
    violations.push(createViolation(element, ContractRule.LIMIT_FIELD_INVALID));
  }

  if (limitFieldDescriptor && isMessageField(limitFieldDescriptor, MONEY_TYPE_NAME) && !isRequiredField(limitFieldDescriptor)) {
    violations.push(createViolation(element, ContractRule.LIMIT_FIELD_NOT_REQUIRED));
  }

  if (limitField !== '' && isSideEffectFree(method)) {
    violations.push(createViolation(element, ContractRule.LIMIT_FIELD_ON_QUERY));
  }

  if (!catalog.has(name)) {
    violations.push(createViolation(element, ContractRule.PERMISSION_NOT_IN_CATALOG));

    return violations;
  }

  const traits = catalog.get(name);

  if (traits && scopeField !== '' && !traits.isScopeApplicable) {
    violations.push(createViolation(element, ContractRule.SCOPE_NOT_APPLICABLE));
  }

  if (traits && limitField !== '' && !traits.isLimitApplicable) {
    violations.push(createViolation(element, ContractRule.LIMIT_NOT_APPLICABLE));
  }

  return violations;
};

const findAccessViolations = (method: DescMethod, catalog: PermissionCatalogValue): ContractViolationValue[] => {
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
    if (!isSideEffectFree(method) && methodAccess.requirement.case !== 'self') {
      violations.push(createViolation(element, ContractRule.COMMAND_PERMISSION_MISSING));
    }

    return violations;
  }

  return [...violations, ...findPermissionViolations(method, methodAccess.requirement.value, catalog)];
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

const findMethodViolations = (method: DescMethod, catalog: PermissionCatalogValue): ContractViolationValue[] => [
  ...findAccessViolations(method, catalog),
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

const getPermissionCodeName = (value: DescEnumValue): string =>
  value.name.startsWith(PERMISSION_CODE_PREFIX) ? value.name.slice(PERMISSION_CODE_PREFIX.length).toLowerCase() : '';

const createPermissionCatalog = (permissionCode: DescEnum): PermissionCatalogValue =>
  new Map(
    permissionCode.values
      .filter(value => value.number !== 0)
      .map(value => [
        getPermissionCodeName(value),
        hasOption(value, permissionTraits) ? getOption(value, permissionTraits) : undefined,
      ]),
  );

const isPermissionNameParsable = (name: string): boolean => {
  const separatorIndex = name.lastIndexOf('_');

  return separatorIndex > 0
    && PERMISSION_FEATURE_PATTERN.test(name.slice(0, separatorIndex))
    && listPermissionActions().includes(name.slice(separatorIndex + 1));
};

const isPlatformPermissionName = (name: string): boolean =>
  PLATFORM_PERMISSION_PREFIXES.some(prefix => name.startsWith(prefix))
  && !name.startsWith(CLIENT_SUPPORT_PERMISSION_PREFIX);

const hasValidPermissionTraits = (name: string, traits: PermissionTraits | undefined): boolean => {
  if (!traits) {
    return false;
  }

  if (traits.isPlatform) {
    return traits.profiles.length === 0
      && !traits.isScopeApplicable
      && !traits.isLimitApplicable
      && isPlatformPermissionName(name);
  }

  return traits.profiles.length > 0
    && traits.profiles.every(profile => profile !== ProfileKind.UNSPECIFIED)
    && !isPlatformPermissionName(name);
};

const findPermissionCatalogViolations = (permissionCode: DescEnum): ContractViolationValue[] =>
  permissionCode.values
    .filter(value => value.number !== 0)
    .flatMap((value) => {
      const element = `${permissionCode.typeName}.${value.name}`;
      const name = getPermissionCodeName(value);
      const traits = hasOption(value, permissionTraits) ? getOption(value, permissionTraits) : undefined;

      return [
        ...(hasValidPermissionTraits(name, traits)
          ? []
          : [createViolation(element, ContractRule.PERMISSION_TRAITS_MISSING)]),
        ...(isPermissionNameParsable(name)
          ? []
          : [createViolation(element, ContractRule.PERMISSION_CODE_INVALID)]),
      ];
    });

export const findContractViolations = (registry: FileRegistry): ContractViolationValue[] => {
  const contractFiles = [...registry.files].filter(isContractFile);
  const permissionCode = requireEnum(registry, PERMISSION_CODE_TYPE_NAME);
  const catalog = createPermissionCatalog(permissionCode);

  return [
    ...contractFiles.flatMap(findPackageViolations),
    ...contractFiles.flatMap(file =>
      file.services.flatMap(service => service.methods.flatMap(method => findMethodViolations(method, catalog)))),
    ...findErrorViolations(registry),
    ...findPermissionCatalogViolations(permissionCode),
  ];
};
