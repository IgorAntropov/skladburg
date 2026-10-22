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
import type { Money } from '@skladburg/contracts/common/v1/money';

import { isMessage } from '@bufbuild/protobuf';
import {
  isReflectMessage,
  reflect,
} from '@bufbuild/protobuf/reflect';
import { MethodOptions_IdempotencyLevel } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import { getMethodAccess } from '@skladburg/contracts/runtime';

import type { IDomainErrors } from '../errors/index';
import type { IStateReader } from '../state/index';
import type { IRequestValidator } from '../validation/index';
import type { PermissionGrantValue } from './permissionGrants';
import type {
  EffectivePermissionValue,
  PermissionScopeValue,
} from './permissionScope';

import { readActingContext } from '../context/index';
import { compareIds } from '../state/index';
import { summarizePermissionGrants } from './effectivePermissions';
import { resolvePermissionGrants } from './permissionGrants';
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
  grants: readonly PermissionGrantValue[];
  membership: Membership;
  organizationId: string;
  permissions: readonly EffectivePermissionValue[];
}

interface ScopeCheckValue {
  grants: readonly PermissionGrantValue[];
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

    const grants = resolvePermissionGrants(reader, membership);

    return { grants, membership, organizationId, permissions: summarizePermissionGrants(grants) };
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

    if (requirement.case === 'self') {
      return { organization: undefined, scopeCheck: undefined };
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

    return { organization, scopeCheck: { grants: organization.grants, organizationId, requirement: requirement.value, scope } };
  };

  const findField = (method: DescMethodUnary, fieldName: string): DescField => {
    const field = method.input.fields.find(candidate => candidate.name === fieldName);

    if (field === undefined) {
      throw errors.internal();
    }

    return field;
  };

  const readScopeFieldValue = (method: DescMethodUnary, request: MessageShape<DescMessage>, scopeField: string): string => {
    const value = reflect(method.input, request).get(findField(method, scopeField));

    if (typeof value !== 'string') {
      throw errors.internal();
    }

    return value;
  };

  const readLimitFieldValue = (method: DescMethodUnary, request: MessageShape<DescMessage>, limitField: string): Money => {
    const message = reflect(method.input, request);
    const field = findField(method, limitField);
    const value = message.isSet(field) ? message.get(field) : undefined;

    if (!isReflectMessage(value) || !isMessage(value.message, MoneySchema)) {
      throw errors.internal();
    }

    return value.message;
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

  const pickReportedLimit = (limits: readonly Money[], requested: Money): Money | undefined => {
    const sameCurrency = limits.filter(limit => limit.currencyCode === requested.currencyCode);
    const candidates = sameCurrency.length > 0 ? sameCurrency : limits;

    return candidates.reduce<Money | undefined>((largest, candidate) => {
      if (largest === undefined || candidate.amountMinor > largest.amountMinor) {
        return candidate;
      }

      const isTie = candidate.amountMinor === largest.amountMinor;

      return isTie && compareIds(candidate.currencyCode, largest.currencyCode) < 0 ? candidate : largest;
    }, undefined);
  };

  const enforceLimit = (
    method: DescMethodUnary,
    request: MessageShape<DescMessage>,
    check: ScopeCheckValue,
    warehouseId: string,
  ): void => {
    const { limitField, name } = check.requirement;

    if (limitField === '') {
      return;
    }

    const requested = readLimitFieldValue(method, request, limitField);
    const covering = check.grants.filter(grant =>
      grant.permission === name && (grant.isOrganizationWide || (warehouseId !== '' && grant.warehouseIds.includes(warehouseId))));
    const limits = covering.flatMap(grant => grant.amountLimit === undefined ? [] : [grant.amountLimit]);

    if (limits.length < covering.length) {
      return;
    }

    const isWithinLimit = limits.some(limit => limit.currencyCode === requested.currencyCode && requested.amountMinor <= limit.amountMinor);

    if (isWithinLimit) {
      return;
    }

    const reported = pickReportedLimit(limits, requested);

    if (reported === undefined) {
      throw errors.internal();
    }

    throw errors.limitExceeded(name, reported, requested);
  };

  const enforceScopeAndLimit = (
    reader: IStateReader,
    method: DescMethodUnary,
    request: MessageShape<DescMessage>,
    check: ScopeCheckValue,
    isScopeFiltered: boolean,
  ): void => {
    const { scopeField } = check.requirement;
    const warehouseId = scopeField === '' ? '' : readScopeFieldValue(method, request, scopeField);

    if (scopeField !== '') {
      enforceWarehouseScope(reader, check, warehouseId);
    }

    if (!isScopeFiltered) {
      enforceLimit(method, request, check, warehouseId);
    }
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
      enforceScopeAndLimit(reader, method, request, scopeCheck, isScopeFiltered);
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
