import type { Money } from '@skladburg/contracts/common/v1/money';

import type { IDomainErrors } from '../errors/index';
import type { PermissionGrantValue } from './permissionGrants';

import { compareIds } from '../state/index';

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

export const enforcePermissionAmountLimit = (
  grants: readonly PermissionGrantValue[],
  permission: string,
  requested: Money,
  errors: IDomainErrors,
  warehouseId = '',
): void => {
  const covering = grants.filter(grant =>
    grant.permission === permission && (grant.isOrganizationWide || (warehouseId !== '' && grant.warehouseIds.includes(warehouseId))));
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

  throw errors.limitExceeded(permission, reported, requested);
};
