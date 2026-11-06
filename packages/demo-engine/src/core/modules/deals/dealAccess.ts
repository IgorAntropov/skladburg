import type { Money } from '@skladburg/contracts/common/v1/money';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { PermissionCallerValue } from '../../access/index';
import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import {
  enforcePermissionAmountLimit,
  resolvePermissionGrants,
} from '../../access/index';
import { isProfileVerified } from '../../visibility/index';
import { failDealValidation } from './dealRules';
import { isDealVisibleToOrganization } from './dealVisibility';

export const readVisibleDeal = (
  reader: IStateReader,
  errors: IDomainErrors,
  dealId: string,
  caller: PermissionCallerValue,
): Deal => {
  const deal = reader.get('deals', dealId);
  const isVisible = deal !== undefined && caller.admission.kind === 'membership'
    && isDealVisibleToOrganization(deal, caller.organizationId);
  if (!isVisible) {
    throw errors.notFound(EntityKind.DEAL);
  }
  return deal;
};

export const requireDealPartyProfiles = (reader: IStateReader, errors: IDomainErrors, supplierId: string, customerId: string): void => {
  if (supplierId === customerId) {
    failDealValidation(errors, 'supplier_organization_id', 'deal.same_organization');
  }
  const supplier = reader.get('organizations', supplierId);
  const customer = reader.get('organizations', customerId);
  if (supplier === undefined || customer === undefined
    || !isProfileVerified(supplier, ProfileKind.SUPPLIER) || !isProfileVerified(customer, ProfileKind.CUSTOMER)) {
    throw errors.notFound(EntityKind.ORGANIZATION);
  }
};

export const checkDealApproval = (
  reader: IStateReader,
  errors: IDomainErrors,
  caller: PermissionCallerValue,
  actual: Money | undefined,
  confirmed: Money | undefined,
): void => {
  if (actual === undefined || confirmed === undefined || caller.admission.kind !== 'membership') {
    throw errors.permissionDenied('deal_approve');
  }
  enforcePermissionAmountLimit(resolvePermissionGrants(reader, caller.admission.membership), 'deal_approve', actual, errors);
  if (actual.amountMinor !== confirmed.amountMinor || actual.currencyCode !== confirmed.currencyCode) {
    failDealValidation(errors, 'goods_total', 'deal.goods_total.mismatch');
  }
};

export const dealActorRoleName = (reader: IStateReader, caller: PermissionCallerValue): string => {
  if (caller.admission.kind !== 'membership') {
    return '';
  }
  return caller.admission.membership.roleAssignments.flatMap((assignment) => {
    const role = reader.get('roles', assignment.roleId);
    return role === undefined ? [] : [role.name];
  }).sort().join(', ');
};
