import type {
  DescField,
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  Membership,
  User,
} from '@skladburg/contracts/access/v1/access';
import type {
  MethodAccess,
  PermissionRequirement,
} from '@skladburg/contracts/common/v1/method_options';

import { reflect } from '@bufbuild/protobuf/reflect';
import { MethodOptions_IdempotencyLevel } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { getMethodAccess } from '@skladburg/contracts/runtime';

import type { IDomainErrors } from '../errors/index';
import type { IStateReader } from '../state/index';
import type { IRequestValidator } from '../validation/index';
import type {
  EffectivePermissionValue,
  PermissionScopeValue,
} from './permissionScope';

import { readActingContext } from '../context/index';
import { resolveEffectivePermissions } from './effectivePermissions';
import { isWarehouseInScope } from './permissionScope';

export interface CallerValue {
  membership: Membership | undefined;
  organizationId: string | undefined;
  permissions: readonly EffectivePermissionValue[];
  scope: PermissionScopeValue | undefined;
  user: User;
}

export interface CallGuardDependenciesValue {
  errors: IDomainErrors;
  validator: IRequestValidator;
}

export type GuardFunction<TCaller> = <TInput extends DescMessage, TOutput extends DescMessage>(
  reader: IStateReader,
  method: DescMethodUnary<TInput, TOutput>,
  request: MessageShape<TInput>,
  headers: Headers,
) => TCaller;

export interface ICallGuard {
  guardCall: GuardFunction<CallerValue>;
  guardMemberCall: GuardFunction<MemberCallerValue>;
  guardPermissionCall: GuardFunction<PermissionCallerValue>;
  guardScopeFilteredCall: GuardFunction<PermissionCallerValue>;
}

export interface MemberCallerValue extends CallerValue {
  membership: Membership;
  organizationId: string;
}

export interface PermissionCallerValue extends MemberCallerValue {
  scope: PermissionScopeValue;
}

interface AuthorizationValue {
  organization: OrganizationContextValue | undefined;
  scopeCheck: ScopeCheckValue | undefined;
}

interface OrganizationContextValue {
  membership: Membership;
  organizationId: string;
  permissions: readonly EffectivePermissionValue[];
}

interface ScopeCheckValue {
  organizationId: string;
  requirement: PermissionRequirement;
  scope: PermissionScopeValue;
}

export const createCallGuard = (dependencies: CallGuardDependenciesValue): ICallGuard => {
  const { errors, validator } = dependencies;

  const authenticate = (reader: IStateReader, userId: string | undefined): User => {
    const user = userId === undefined ? undefined : reader.get('users', userId);

    if (user === undefined) {
      throw errors.sessionRequired();
    }

    return user;
  };

  const joinOrganization = (reader: IStateReader, user: User, organizationId: string): OrganizationContextValue => {
    const membership = reader.listBy('memberships', 'userId', user.id).find(candidate => candidate.organizationId === organizationId);

    if (membership === undefined) {
      throw errors.membershipRequired();
    }

    return { membership, organizationId, permissions: resolveEffectivePermissions(reader, membership) };
  };

  const findPermissionScope = (permissions: readonly EffectivePermissionValue[], permissionName: string): PermissionScopeValue => {
    const effective = permissions.find(candidate => candidate.permission === permissionName);

    if (effective === undefined) {
      throw errors.permissionDenied(permissionName);
    }

    return { isOrganizationWide: effective.isOrganizationWide, warehouseIds: effective.warehouseIds };
  };

  const authorize = (
    reader: IStateReader,
    requirement: MethodAccess['requirement'],
    user: User,
    organizationId: string | undefined,
    isScopeFiltered: boolean,
  ): AuthorizationValue => {
    if (requirement.case === undefined) {
      throw errors.internal();
    }

    if (organizationId === undefined) {
      if (requirement.case !== 'session') {
        throw errors.membershipRequired();
      }

      return { organization: undefined, scopeCheck: undefined };
    }

    const organization = joinOrganization(reader, user, organizationId);

    if (requirement.case !== 'permission') {
      return { organization, scopeCheck: undefined };
    }

    const scope = findPermissionScope(organization.permissions, requirement.value.name);
    const isOrganizationWideRequired = requirement.value.scopeField === '' && !isScopeFiltered;

    if (isOrganizationWideRequired && !scope.isOrganizationWide) {
      throw errors.permissionDenied(requirement.value.name);
    }

    return { organization, scopeCheck: { organizationId, requirement: requirement.value, scope } };
  };

  const readScopeFieldValue = (schema: DescMessage, request: MessageShape<DescMessage>, field: DescField): string => {
    const value = reflect(schema, request).get(field);

    if (typeof value !== 'string') {
      throw errors.internal();
    }

    return value;
  };

  const enforceWarehouseScope = (reader: IStateReader, check: ScopeCheckValue, warehouseId: string): void => {
    const { organizationId, requirement, scope } = check;

    if (warehouseId === '') {
      if (!scope.isOrganizationWide) {
        throw errors.permissionDenied(requirement.name);
      }

      return;
    }

    if (!isWarehouseInScope(scope, warehouseId)) {
      throw errors.permissionDenied(requirement.name, warehouseId);
    }

    if (reader.get('warehouses', warehouseId)?.tenantId !== organizationId) {
      throw errors.notFound(EntityKind.WAREHOUSE);
    }
  };

  const enforceScopeField = (
    reader: IStateReader,
    method: DescMethodUnary,
    request: MessageShape<DescMessage>,
    check: ScopeCheckValue,
  ): void => {
    if (check.requirement.scopeField === '') {
      return;
    }

    const field = method.input.fields.find(candidate => candidate.name === check.requirement.scopeField);

    if (field === undefined) {
      throw errors.internal();
    }

    enforceWarehouseScope(reader, check, readScopeFieldValue(method.input, request, field));
  };

  const runGuard = (
    reader: IStateReader,
    method: DescMethodUnary,
    request: MessageShape<DescMessage>,
    headers: Headers,
    isScopeFiltered: boolean,
  ): CallerValue => {
    const requirement = getMethodAccess(method)?.requirement;

    if (requirement === undefined) {
      throw errors.internal();
    }

    const context = readActingContext(headers);
    const user = authenticate(reader, context.userId);
    const { organization, scopeCheck } = authorize(reader, requirement, user, context.organizationId, isScopeFiltered);

    validator.validate(method.input, request);

    if (scopeCheck !== undefined) {
      enforceScopeField(reader, method, request, scopeCheck);
    }

    return {
      membership: organization?.membership,
      organizationId: organization?.organizationId,
      permissions: organization?.permissions ?? [],
      scope: scopeCheck?.scope,
      user,
    };
  };

  const requireMember = (caller: CallerValue): MemberCallerValue => {
    const { membership, organizationId } = caller;

    if (membership === undefined || organizationId === undefined) {
      throw errors.membershipRequired();
    }

    return { ...caller, membership, organizationId };
  };

  const requirePermission = (caller: CallerValue): PermissionCallerValue => {
    const member = requireMember(caller);
    const { scope } = member;

    if (scope === undefined) {
      throw errors.internal();
    }

    return { ...member, scope };
  };

  const guardCall: GuardFunction<CallerValue> = (reader, method, request, headers) =>
    runGuard(reader, method, request, headers, false);

  const guardMemberCall: GuardFunction<MemberCallerValue> = (reader, method, request, headers) =>
    requireMember(guardCall(reader, method, request, headers));

  const guardPermissionCall: GuardFunction<PermissionCallerValue> = (reader, method, request, headers) =>
    requirePermission(guardCall(reader, method, request, headers));

  const guardScopeFilteredCall: GuardFunction<PermissionCallerValue> = (reader, method, request, headers) => {
    if (method.idempotency !== MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS) {
      throw errors.internal();
    }

    return requirePermission(runGuard(reader, method, request, headers, true));
  };

  return { guardCall, guardMemberCall, guardPermissionCall, guardScopeFilteredCall };
};
